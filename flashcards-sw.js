/* flashcards-sw.js — offline support for the flashcards app only.
   Registered by flashcards/app.js with scope "./flashcards", so it controls
   flashcards.html and flashcards/… but none of the site's other pages or games.

   - flashcards.html, flashcards/cards.js and flashcards/figures/index.js: network first
     (students always get the newest cards when online), cached copy when offline.
   - Everything else (versioned with ?v=, fonts, icons, diagram pictures — their names change
     whenever the diagram changes): cache first.
   - Other websites (TikZJax, only for diagrams without a picture): not touched.
   Bump CACHE when this file changes; ASSETS should match the ?v= numbers in flashcards.html
   (a mismatch only means those files are cached on first use instead of at install). */
const VERSION = '2.9.0';
const CACHE = 'flashcards-' + VERSION;
const ASSETS = [
  'flashcards.html',
  'flashcards/cards.js',
  'flashcards/figures/index.js',
  'flashcards/styles.css?v=' + VERSION,
  'flashcards/app.js?v=' + VERSION,
  'flashcards/srs.js?v=' + VERSION,
  'flashcards/celebrate.js?v=' + VERSION,
  'flashcards/poster.js?v=' + VERSION,
  'flashcards/cards-format.js?v=' + VERSION,
  'flashcards/manifest.webmanifest',
  'flashcards/vendor/katex/katex.min.css',
  'flashcards/vendor/katex/katex.min.js',
  'flashcards/vendor/katex/auto-render.min.js',
  'flashcards/vendor/prompt/prompt.css',
  ...[400, 500, 600, 700, 800].flatMap(w => ['thai', 'latin'].map(s => `flashcards/vendor/prompt/files/prompt-${s}-${w}-normal.woff2`)),
  'flashcards/icons/icon-192.png',
  'flashcards/icons/favicon-64.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one by one, so a single missing file never blocks the install
    await Promise.all(ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // only this app's older versions ("flashcards-2.4.0"…), never other caches on the site
    await Promise.all(keys.filter(k => /^flashcards-\d/.test(k) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-cache' });
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // TikZJax etc.: browser handles it
  const path = url.pathname;
  if (req.mode === 'navigate' || path.endsWith('/flashcards.html') || path.endsWith('/flashcards/cards.js') || path.endsWith('/flashcards/figures/index.js')) {
    event.respondWith(networkFirst(req));
  } else if (path.includes('/flashcards/')) {
    event.respondWith(cacheFirst(req));
  }
});
