const CACHE_NAME = 'trackerbox-shell-v1';
const APP_SHELL = ['./', './trackerbox.html', './sw.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: isNavigation });

    if (isNavigation) {
      try {
        const fresh = await fetch(event.request);
        cache.put('./trackerbox.html', fresh.clone());
        return fresh;
      } catch (error) {
        return cached || cache.match('./trackerbox.html') || Response.error();
      }
    }

    if (cached) {
      event.waitUntil(
        fetch(event.request)
          .then((fresh) => {
            if (fresh && fresh.ok) return cache.put(event.request, fresh.clone());
          })
          .catch(() => {})
      );
      return cached;
    }

    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.ok) {
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      return cache.match('./trackerbox.html') || Response.error();
    }
  })());
});
