/* ============================================================
   Selah — service worker
   Offline shell + web push (daily verse / lesson reminder)
   ============================================================ */
const VERSION = 'selah-v8';
const SHELL = [
  './', './index.html', './styles.css',
  './config.js', './data.js', './journey.js', './path.js', './cards.js', './share.js', './push.js', './sync.js', './app.js',
  './manifest.webmanifest',
  './assets/pilgrim.png', './assets/icon-192.png', './assets/icon-512.png',
  './assets/icon-180.png', './assets/favicon.png',
  './assets/glass-bg.jpg', './assets/road.jpg', './assets/road-card.jpg',
  // the 30 story windows are ~3.9MB together, so they are NOT precached —
  // the runtime handler below caches each one the first time it's scrolled to
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // addAll is all-or-nothing; add individually so one missing asset can't
    // wedge the whole install
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Scripture APIs: network first, fall back to whatever we cached
  if (/bible-api\.com|api\.esv\.org|api\.nlt\.to/.test(url.hostname)) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) (await caches.open(VERSION)).put(req, r.clone());
        return r;
      } catch { return (await caches.match(req)) || Response.error(); }
    })());
    return;
  }

  // never cache Supabase — it's live state
  if (/supabase\.(co|in)$/.test(url.hostname)) return;

  // app shell + fonts: cache first, refresh in the background
  e.respondWith((async () => {
    const hit = await caches.match(req);
    const net = fetch(req).then(r => {
      if (r.ok && (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.hostname)))
        caches.open(VERSION).then(c => c.put(req, r.clone()));
      return r;
    }).catch(() => null);
    if (hit) return hit;
    const r = await net;
    if (r) return r;
    // offline navigation always lands on the shell
    if (req.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  })());
});

/* ---------------- push ---------------- */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'Selah';
  const opts = {
    body: d.body || 'Your verse is waiting.',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    tag: d.tag || 'selah',
    renotify: true,
    vibrate: [12, 60, 12],
    data: { view: d.view || 'read', ref: d.ref || null },
    actions: d.view === 'learn'
      ? [{ action: 'open', title: 'Start lesson' }]
      : [{ action: 'open', title: 'Read it' }],
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const view = (e.notification.data && e.notification.data.view) || 'read';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/selah') || c.url.includes(location.origin)) {
        c.postMessage({ type: 'goto', view });
        return c.focus();
      }
    }
    return self.clients.openWindow('./?view=' + view);
  })());
});

self.addEventListener('message', e => {
  const m = e.data || {};

  // the page asks which build it's running, for the version row in Me.
  // Reply down the transferred port when there is one, since that's what
  // the page is listening on.
  if (m.type === 'version') {
    const reply = { type: 'version', version: VERSION };
    if (e.ports && e.ports[0]) e.ports[0].postMessage(reply);
    else if (e.source) e.source.postMessage(reply);
    return;
  }
  // a waiting worker can be told to take over immediately
  if (m.type === 'skip-waiting') { self.skipWaiting(); return; }

  /* local (no-server) fallback: fire a reminder now */
  if (m.type === 'local-notify') {
    self.registration.showNotification(m.title || 'Selah', {
      body: m.body, icon: './assets/icon-192.png', badge: './assets/icon-192.png',
      tag: m.tag || 'selah-local', data: { view: m.view || 'read' },
    });
  }
});
