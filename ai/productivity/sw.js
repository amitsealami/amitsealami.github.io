/* Service worker: caches the app shell so the page opens with no network and no server.
   Network first, so a fresh deploy is picked up on the next load; cache as fallback.
   API calls are never cached. */
const CACHE = 'productivity-tracker-v1';
const SHELL = ['./', 'index.html', 'app.js', 'store.js', 'style.css', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'sounds/kitchen-timer.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./')))
  );
});
