const CACHE_NAME = 'cube-code-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/style.css',
  '/src/main.js',
  '/src/encoder.js',
  '/src/decoder.js',
  '/src/cube3d.js',
  '/src/crossnet.js',
  '/src/scanner.js',
  '/src/quickscan.js',
  '/src/utils.js',
  '/src/encoder-utils.js'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
