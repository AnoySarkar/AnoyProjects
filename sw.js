const CACHE_NAME = 'trackerbox-shell-v4';
const APP_SHELL = ['./', './trackerbox.html', './sw.js', './manifest.json', './icon-192.png', './icon-512.png'];
const REMOTE_STARTUP_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

const canCacheResponse = (response) => response && (response.ok || response.type === 'opaque');

async function warmStartupAssets(cache) {
  await Promise.allSettled([
    cache.addAll(APP_SHELL),
    ...REMOTE_STARTUP_ASSETS.map(async (url) => {
      try {
        const response = await fetch(url, { mode: 'no-cors', cache: 'no-cache' });
        if (canCacheResponse(response)) {
          await cache.put(url, response.clone());
        }
      } catch (error) {}
    })
  ]);
}

async function refreshCachedRequest(cache, request, cacheKey = request) {
  try {
    const response = await fetch(request);
    if (canCacheResponse(response)) {
      await cache.put(cacheKey, response.clone());
    }
  } catch (error) {}
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await warmStartupAssets(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key !== CACHE_NAME)
      .map((key) => caches.delete(key))
    );
    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
      } catch (error) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigation = event.request.mode === 'navigate';
  const isRemoteStartupAsset = REMOTE_STARTUP_ASSETS.includes(event.request.url);

  if (!isSameOrigin && !isRemoteStartupAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation) {
      const cachedShell = await cache.match('./trackerbox.html') || await cache.match('./');
      if (cachedShell) {
        event.waitUntil((async () => {
          try {
            const preload = await event.preloadResponse;
            const fresh = preload || await fetch(event.request);
            if (canCacheResponse(fresh)) {
              await cache.put('./trackerbox.html', fresh.clone());
            }
          } catch (error) {}
        })());
        return cachedShell;
      }

      try {
        const preload = await event.preloadResponse;
        const fresh = preload || await fetch(event.request);
        if (canCacheResponse(fresh)) {
          await cache.put('./trackerbox.html', fresh.clone());
        }
        return fresh;
      } catch (error) {
        return Response.error();
      }
    }

    const cached = await cache.match(event.request, { ignoreSearch: false });
    if (cached) {
      event.waitUntil(refreshCachedRequest(cache, event.request));
      return cached;
    }

    try {
      const fresh = await fetch(event.request);
      if (canCacheResponse(fresh)) {
        await cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      if (isRemoteStartupAsset) {
        const fallback = await cache.match(event.request);
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
