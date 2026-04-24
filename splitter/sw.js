const CACHE_NAME = 'smart-prompt-splitter-v5';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });

    if (event.request.mode === 'navigate') {
      try {
        const fresh = await fetch(event.request);
        if (fresh.ok) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (error) {
        return cached || cache.match('./index.html');
      }
    }

    if (cached) return cached;

    try {
      const fresh = await fetch(event.request);
      if (fresh.ok || fresh.type === 'opaque') {
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});
