const CACHE_NAME = 'trackerbox-v1';
const ASSETS_TO_CACHE = [
  './trackerbox.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install the service worker and cache our files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Intercept requests and return the cached version if offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
