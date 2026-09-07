const CACHE_NAME = 'etf-portfolio-cache-v12';
const ASSETS_TO_CACHE = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass API calls through to network
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Network-First strategy: always fetch freshest assets from server first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
