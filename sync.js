/* ============================================================
   Selah — cloud sync & friends
   Talks to Supabase over plain REST so the app carries no SDK.
   Signed out, everything still lives on the device.
   ============================================================ */
'use strict';

const Sync = (() => {
  const CFG = () => window.SELAH_CONFIG || {};
  const ready = () => !!(CFG().SUPABASE_URL && CFG().SUPABASE_ANON_KEY);

  /* ---------------- session ---------------- */
  const SKEY = 'selah.session';
  let S = null;
  try { S = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { S = null; }
  const setSession = s => { S = s; s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); };
  const signedIn = () => !!(S && S.access_token);
  const me = () => (S && S.user) || null;

  async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
    if (!ready()) throw new Error('sync-not-configured');
    const h = Object.assign({
      apikey: CFG().SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    }, headers);
    if (auth && signedIn()) h.Authorization = 'Bearer ' + S.access_token;
    let r = await fetch(CFG().SUPABASE_URL + path, {
      method, headers: h, body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && signedIn()) {          // token aged out — refresh once
      if (await refresh()) {
        h.Authorization = 'Bearer ' + S.access_token;
        r = await fetch(CFG().SUPABASE_URL + path, {
          method, headers: h, body: body ? JSON.stringify(body) : undefined,
        });
      }
    }
    if (!r.ok) throw new Error((await r.text()) || r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const rest = (t, q = '', o = {}) => api(`/rest/v1/${t}${q}`, o);

  async function refresh() {
    try {
      const d = await api('/auth/v1/token?grant_type=refresh_token',
        { method: 'POST', auth: false, body: { refresh_token: S.refresh_token } });
      setSession(d); return true;
    } catch { setSession(null); return false; }
  }

  /* ---------------- auth (email code, no password) ---------------- */
  const sendCode = email =>
    api('/auth/v1/otp', { method: 'POST', auth: false, body: { email, create_user: true } });

  async function verifyCode(email, token) {
    const d = await api('/auth/v1/verify',
      { method: 'POST', auth: false, body: { email, token, type: 'email' } });
    setSession(d);
    await ensureProfile();
    await firstSync();
    return d;
  }
  function signOut() { setSession(null); }

  /* ---------------- profile ---------------- */
  async function ensureProfile() {
    const local = DB.profile() || { name: 'Pilgrim', avatar: '✝' };
    const rows = await rest('profiles', `?id=eq.${me().id}&select=*`);
    if (rows && rows.length) return rows[0];
    let handle = (local.name || 'pilgrim').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
    if (handle.length < 2) handle = 'pilgrim';
    for (let n = 0; n < 6; n++) {
      try {
        return (await rest('profiles', '', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: { id: me().id, handle, display_name: local.name, avatar: local.avatar },
        }))[0];
      } catch (e) {
        if (!/duplicate|unique/i.test(e.message)) throw e;
        handle = handle.slice(0, 11) + Math.floor(Math.random() * 900 + 100);   // handle taken
      }
    }
    throw new Error('could not claim a handle');
  }

  const publicStats = () => ({
    streak: streakCount(),
    chapters_read: window.Journey ? Journey.chaptersRead() : 0,
    memorized: masteredCount(),
    total_xp: totalXP(),
    current_book: window.Journey ? Journey.currentBook().name : null,
    updated_at: new Date().toISOString(),
  });

  const updateProfile = patch =>
    rest('profiles', `?id=eq.${me().id}`, { method: 'PATCH', body: patch });

  /* ---------------- state merge ----------------
     Both sides are additive, so union wins and nobody loses a chapter
     by opening the app on a second phone.                            */
  function mergeState(local, remote) {
    if (!remote) return local;
    const out = { ...local };

    out.journey = { ...(remote.journey || {}) };
    Object.entries(local.journey || {}).forEach(([b, arr]) => {
      out.journey[b] = [...new Set([...(out.journey[b] || []), ...arr])].sort((a, z) => a - z);
    });

    out.activity = { ...(remote.activity || {}) };
    Object.entries(local.activity || {}).forEach(([d, v]) => {
      const r = out.activity[d] || { xp: 0, read: 0, lessons: 0 };
      out.activity[d] = {
        xp: Math.max(r.xp || 0, v.xp || 0),
        read: Math.max(r.read || 0, v.read || 0),
        lessons: Math.max(r.lessons || 0, v.lessons || 0),
      };
    });

    out.srs = { ...(remote.srs || {}) };
    Object.entries(local.srs || {}).forEach(([ref, c]) => {
      const r = out.srs[ref];
      out.srs[ref] = (!r || (c.reps || 0) > (r.reps || 0)) ? c : r;   // further along wins
    });

    const seen = new Set();
    out.saved = [...(local.saved || []), ...(remote.saved || [])]
      .filter(v => !seen.has(v[0]) && seen.add(v[0]));

    out.prefs = Object.assign({}, remote.prefs, local.prefs);   // this device's choice wins
    return out;
  }

  const localState = () => {
    const s = settings();
    return {
      journey: DB.get('journey', {}), activity: DB.get('activity', {}),
      srs: DB.get('srs', {}), saved: DB.get('saved', []),
      // never the API keys — only what another device (or the push function) needs
      prefs: { goal: s.goal, translation: s.translation },
      streak: streakCount(),
    };
  };
  function writeState(s) {
    DB.set('journey', s.journey || {}); DB.set('activity', s.activity || {});
    DB.set('srs', s.srs || {}); DB.set('saved', s.saved || []);
    if (s.prefs) saveSettings(Object.assign(settings(), {
      goal: s.prefs.goal || 30, translation: s.prefs.translation || 'web',
    }));
  }

  async function firstSync() {
    const rows = await rest('progress', `?user_id=eq.${me().id}&select=*`);
    const remote = rows && rows[0] ? rows[0].state : null;
    const merged = mergeState(localState(), remote);
    writeState(merged);
    await pushState(merged);
    await updateProfile(publicStats());
  }

  async function pushState(state) {
    await rest('progress', '', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { user_id: me().id, state: state || localState(), updated_at: new Date().toISOString() },
    });
  }

  /* debounced write-behind so a lesson doesn't fire ten requests */
  let t = null, dirty = false;
  function queue() {
    if (!signedIn() || !ready()) return;
    dirty = true;
    clearTimeout(t);
    t = setTimeout(async () => {
      if (!dirty) return;
      dirty = false;
      try { await pushState(); await updateProfile(publicStats()); } catch (e) { dirty = true; }
    }, 4000);
  }
  window.addEventListener('online', () => { if (dirty) queue(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty && signedIn()) {
      // best effort on the way out
      try { pushState(); } catch (e) {}
    }
  });

  /* ---------------- friends ---------------- */
  const friends = () => rest('friend_view', '?select=*&order=streak.desc');
  const pending = () => rest('friend_requests_in', '?select=*');

  async function addFriend(handle) {
    const h = handle.replace(/^@/, '').toLowerCase().trim();
    // through the RPC, not the table — strangers can't read profiles directly
    const rows = await api('/rest/v1/rpc/find_profile', { method: 'POST', body: { h } });
    if (!rows || !rows.length) throw new Error('No pilgrim by that name');
    if (rows[0].id === me().id) throw new Error('That’s you');
    await rest('friendships', '', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { requester: me().id, addressee: rows[0].id, status: 'pending' },
    });
    return rows[0];
  }
  const acceptFriend = id => rest('friendships',
    `?requester=eq.${id}&addressee=eq.${me().id}`, { method: 'PATCH', body: { status: 'accepted' } });
  const removeFriend = id => rest('friendships',
    `?or=(and(requester.eq.${me().id},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me().id}))`,
    { method: 'DELETE' });

  const friendHighlights = id =>
    rest('highlights', `?user_id=eq.${id}&select=*&order=created_at.desc&limit=40`);

  async function pushHighlight(ref, text, color) {
    if (!signedIn() || !ready()) return;
    try {
      await rest('highlights', '', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: { user_id: me().id, ref, text, color: color || 'gold' },
      });
    } catch (e) {}
  }
  async function dropHighlight(ref) {
    if (!signedIn() || !ready()) return;
    try { await rest('highlights', `?user_id=eq.${me().id}&ref=eq.${encodeURIComponent(ref)}`, { method: 'DELETE' }); }
    catch (e) {}
  }

  /* ---------------- push subscriptions ---------------- */
  async function saveSubscription(sub) {
    if (!signedIn()) return;
    const c = pushCfg();
    await rest('push_subs', '', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: {
        user_id: me().id, endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh, auth: sub.keys.auth,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        verse_on: c.verseOn, verse_time: c.verseTime,
        lesson_on: c.lessonOn, lesson_time: c.lessonTime,
      },
    });
  }
  const dropSubscription = endpoint =>
    rest('push_subs', `?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' });

  async function saveReminderPrefs(c) {
    if (!signedIn()) return;
    try {
      await rest('push_subs', `?user_id=eq.${me().id}`, {
        method: 'PATCH',
        body: {
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          verse_on: c.verseOn, verse_time: c.verseTime,
          lesson_on: c.lessonOn, lesson_time: c.lessonTime,
        },
      });
    } catch (e) {}
  }

  return {
    ready, signedIn, me, sendCode, verifyCode, signOut,
    firstSync, pushState, queue, mergeState,
    friends, pending, addFriend, acceptFriend, removeFriend, friendHighlights,
    pushHighlight, dropHighlight,
    saveSubscription, dropSubscription, saveReminderPrefs,
    ensureProfile, updateProfile, publicStats,
  };
})();

window.Sync = Sync;
