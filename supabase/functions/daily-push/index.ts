/* ============================================================
   Selah — daily-push
   Cron hits this every 10 minutes. It walks every push
   subscription, works out the local time on that device, and
   sends the daily verse / lesson nudge when the clock lines up.
   Each kind is stamped per local date, so nobody gets two.
   ============================================================ */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:codedbycb@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const db = createClient(SUPABASE_URL, SERVICE_KEY);

/* a small pool so the function needs no extra round trip */
const VERSES: [string, string][] = [
  ['Psalm 118:24', 'This is the day that Yahweh has made. We will rejoice and be glad in it!'],
  ['Lamentations 3:23', 'They are new every morning. Great is your faithfulness.'],
  ['Proverbs 3:5', 'Trust in Yahweh with all your heart, and don’t lean on your own understanding.'],
  ['Isaiah 41:10', 'Don’t be afraid, for I am with you. Don’t be dismayed, for I am your God.'],
  ['Psalm 46:10', 'Be still, and know that I am God.'],
  ['Joshua 1:9', 'Be strong and courageous. Don’t be afraid, for Yahweh your God is with you wherever you go.'],
  ['Philippians 4:6', 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.'],
  ['Matthew 6:33', 'Seek first God’s Kingdom and his righteousness; and all these things will be given to you as well.'],
  ['Psalm 23:1', 'Yahweh is my shepherd; I shall lack nothing.'],
  ['Romans 8:28', 'We know that all things work together for good for those who love God.'],
  ['Psalm 34:18', 'Yahweh is near to those who have a broken heart.'],
  ['Isaiah 40:31', 'Those who wait for Yahweh will renew their strength. They will mount up with wings like eagles.'],
  ['John 14:27', 'Peace I leave with you. My peace I give to you.'],
  ['Hebrews 13:8', 'Jesus Christ is the same yesterday, today, and forever.'],
  ['Psalm 119:105', 'Your word is a lamp to my feet, and a light for my path.'],
  ['Zephaniah 3:17', 'Yahweh, your God, is among you, a mighty one who will save.'],
  ['2 Corinthians 12:9', 'My grace is sufficient for you, for my power is made perfect in weakness.'],
  ['Galatians 6:9', 'Let us not be weary in doing good, for we will reap in due season, if we don’t give up.'],
  ['1 Peter 5:7', 'Casting all your worries on him, because he cares for you.'],
  ['Psalm 27:1', 'Yahweh is my light and my salvation. Whom shall I fear?'],
];

/* what the clock says where this device lives */
function localParts(tz: string) {
  const now = new Date();
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(now)) p[type] = value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10),
  };
}
const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/* fires when we're inside the window and haven't already sent today.
   The window is generous so a late cron tick still delivers. */
const WINDOW = 15;
const dueNow = (target: number, nowMin: number) => {
  const d = nowMin - target;
  return d >= 0 && d < WINDOW;
};

Deno.serve(async (req) => {
  // simple shared-secret gate so only cron can ring the bell
  const secret = Deno.env.get('CRON_SECRET');
  if (secret) {
    const given = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('key');
    if (given !== secret) return new Response('nope', { status: 401 });
  }

  const { data: subs, error } = await db.from('push_subs').select('*');
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0, pruned = 0;
  const today: Record<string, { date: string; minutes: number }> = {};

  for (const s of subs ?? []) {
    const tz = s.tz || 'UTC';
    if (!today[tz]) { try { today[tz] = localParts(tz); } catch { today[tz] = localParts('UTC'); } }
    const { date, minutes } = today[tz];

    const jobs: { kind: 'verse' | 'lesson'; payload: Record<string, unknown> }[] = [];

    if (s.verse_on && s.last_verse_sent !== date && dueNow(toMinutes(s.verse_time), minutes)) {
      // deterministic per user per day: everyone gets a verse, nobody gets the same one twice running
      const seed = (date + s.endpoint).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      const [ref, text] = VERSES[seed % VERSES.length];
      jobs.push({ kind: 'verse', payload: { title: ref, body: text, view: 'read', tag: 'verse', ref } });
    }

    if (s.lesson_on && s.last_lesson_sent !== date && dueNow(toMinutes(s.lesson_time), minutes)) {
      // only nudge if they haven't already hit the day's goal
      const { data: prog } = await db.from('progress').select('state').eq('user_id', s.user_id).maybeSingle();
      const state = (prog?.state ?? {}) as any;
      const goal = Number(state?.prefs?.goal ?? 30);
      const xp = Number(state?.activity?.[date]?.xp ?? 0);
      if (xp < goal) {
        const streak = Number(state?.streak ?? 0);
        jobs.push({
          kind: 'lesson',
          payload: {
            title: streak > 1 ? `Don’t break your ${streak}-day streak` : 'Time to hide the Word',
            body: 'A few verses is all today asks.',
            view: 'learn', tag: 'lesson',
          },
        });
      } else {
        await db.from('push_subs').update({ last_lesson_sent: date }).eq('endpoint', s.endpoint);
      }
    }

    for (const job of jobs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(job.payload),
          { TTL: 3600 },
        );
        sent++;
        await db.from('push_subs')
          .update(job.kind === 'verse' ? { last_verse_sent: date } : { last_lesson_sent: date })
          .eq('endpoint', s.endpoint);
      } catch (e: any) {
        // 404/410 mean the browser threw the subscription away
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await db.from('push_subs').delete().eq('endpoint', s.endpoint);
          pruned++;
        } else {
          console.error('push failed', s.endpoint, e?.statusCode, e?.body ?? e?.message);
        }
      }
    }
  }

  return Response.json({ ok: true, subs: subs?.length ?? 0, sent, pruned });
});
