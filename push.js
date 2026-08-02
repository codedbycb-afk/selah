/* ============================================================
   Selah — reminders
   · Daily verse at a time you pick
   · "Do your lesson" nudge if the day's goal isn't met
   Real web push when Supabase + VAPID are configured;
   an on-device fallback when they aren't.
   ============================================================ */
'use strict';

const PushDefaults = {
  verseOn: false, verseTime: '07:00',
  lessonOn: false, lessonTime: '20:00',
};
const pushCfg = () => Object.assign({}, PushDefaults, DB.get('push', {}));
const savePush = c => DB.set('push', c);

const Push = (() => {
  let reg = null;

  const supported = () => 'serviceWorker' in navigator && 'Notification' in window;
  const canPush  = () => supported() && 'PushManager' in window;
  /* iOS only allows notifications once the app is on the home screen */
  const installed = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

  async function register() {
    if (!supported()) return null;
    try {
      reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data && e.data.type === 'goto') go(e.data.view);
      });
      return reg;
    } catch (e) { return null; }
  }

  function urlB64ToUint8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  /* ask, subscribe, and hand the subscription to the backend */
  async function enable() {
    if (!supported()) { toast('This browser can’t do reminders'); return false; }
    if (isIOS() && !installed()) {
      toast('Add Selah to your Home Screen first');
      return false;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Reminders blocked in settings'); return false; }
    if (!reg) await register();

    const key = (window.SELAH_CONFIG || {}).VAPID_PUBLIC_KEY;
    if (canPush() && key && window.Sync && Sync.ready()) {
      try {
        const sub = await reg.pushManager.getSubscription() ||
          await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8(key),
          });
        await Sync.saveSubscription(sub.toJSON());
      } catch (e) { /* fall through to the on-device path */ }
    }
    scheduleLocal();
    return true;
  }

  async function disable() {
    try {
      if (!reg) reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) { if (window.Sync && Sync.ready()) await Sync.dropSubscription(sub.endpoint); await sub.unsubscribe(); }
    } catch (e) {}
    clearLocal();
  }

  /* ------------------------------------------------------------
     On-device fallback. Only fires while the app is running, so it
     is a backstop, not the plan — real delivery is the edge function.
     ------------------------------------------------------------ */
  let timers = [];
  function clearLocal() { timers.forEach(clearTimeout); timers = []; }
  function msUntil(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const now = new Date(), t = new Date();
    t.setHours(h, m, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    return t - now;
  }
  function fire(payload) {
    if (Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(r =>
      r.active && r.active.postMessage(Object.assign({ type: 'local-notify' }, payload)));
  }
  function scheduleLocal() {
    clearLocal();
    const c = pushCfg();
    if (c.verseOn) timers.push(setTimeout(() => {
      const [ref, text] = POOL[Math.floor(Math.random() * POOL.length)];
      fire({ title: ref, body: text.length > 140 ? text.slice(0, 137) + '…' : text, view: 'read', tag: 'verse' });
      scheduleLocal();
    }, msUntil(c.verseTime)));
    if (c.lessonOn) timers.push(setTimeout(() => {
      if (todayXP() < settings().goal) {
        const s = streakCount();
        fire({
          title: s > 1 ? `Keep your ${s}-day streak` : 'Time to hide the Word',
          body: 'A few verses is all it takes today.', view: 'learn', tag: 'lesson',
        });
      }
      scheduleLocal();
    }, msUntil(c.lessonTime)));
  }

  /* ------------------------------------------------------------
     Settings card, rendered into the Me page
     ------------------------------------------------------------ */
  function card() {
    const c = pushCfg();
    const perm = supported() ? Notification.permission : 'unsupported';
    const blocked = perm === 'denied';
    const needInstall = isIOS() && !installed();
    return `
    <div class="setting-group">
      <div class="group-h caps">Reminders</div>
      ${needInstall ? `<div class="note">Add Selah to your Home Screen to turn on reminders.
        <small>Share → Add to Home Screen</small></div>` : ''}
      ${blocked ? `<div class="note warn">Notifications are blocked for Selah in your browser settings.</div>` : ''}
      <div class="setting">
        <div class="lab"><b>Daily verse</b><span>One verse, every morning</span></div>
        <label class="sw"><input type="checkbox" id="verseOn" ${c.verseOn ? 'checked' : ''}><i></i></label>
      </div>
      <div class="setting sub ${c.verseOn ? '' : 'off'}">
        <div class="lab"><span>Delivered at</span></div>
        <input type="time" id="verseTime" value="${c.verseTime}">
      </div>
      <div class="setting">
        <div class="lab"><b>Lesson reminder</b><span>Only if you haven’t hit today’s goal</span></div>
        <label class="sw"><input type="checkbox" id="lessonOn" ${c.lessonOn ? 'checked' : ''}><i></i></label>
      </div>
      <div class="setting sub ${c.lessonOn ? '' : 'off'}">
        <div class="lab"><span>Nudge at</span></div>
        <input type="time" id="lessonTime" value="${c.lessonTime}">
      </div>
      ${(c.verseOn || c.lessonOn) ? `<button class="cta ghost sm" id="testNotif">Send a test</button>` : ''}
    </div>`;
  }

  function wire(rerender) {
    const upd = async (patch) => {
      const c = Object.assign(pushCfg(), patch);
      if ((patch.verseOn || patch.lessonOn) && Notification.permission !== 'granted') {
        const ok = await enable();
        if (!ok) { rerender(); return; }
      }
      savePush(c);
      if (window.Sync && Sync.ready()) Sync.saveReminderPrefs(c);
      if (!c.verseOn && !c.lessonOn) disable(); else scheduleLocal();
      rerender();
    };
    const el = id => document.getElementById(id);
    el('verseOn')  && (el('verseOn').onchange  = e => upd({ verseOn: e.target.checked }));
    el('lessonOn') && (el('lessonOn').onchange = e => upd({ lessonOn: e.target.checked }));
    el('verseTime')  && (el('verseTime').onchange  = e => upd({ verseTime: e.target.value }));
    el('lessonTime') && (el('lessonTime').onchange = e => upd({ lessonTime: e.target.value }));
    el('testNotif')  && (el('testNotif').onclick   = () => {
      if (Notification.permission !== 'granted') return toast('Turn a reminder on first');
      const [ref, text] = POOL[Math.floor(Math.random() * POOL.length)];
      fire({ title: ref, body: text, view: 'read', tag: 'test' });
      toast('Sent');
    });
  }

  return { register, enable, disable, scheduleLocal, card, wire, supported, installed, isIOS };
})();

window.Push = Push;
