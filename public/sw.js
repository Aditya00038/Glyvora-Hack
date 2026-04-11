const CACHE_NAME = 'glyvora-v1';
const ML_CACHE_NAME = 'glyvora-ml-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install for offline ML functionality
const OFFLINE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  // Food database for local predictions
  '/indian-foods.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache core offline assets
      caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)),
      // Separate cache for ML models and training data
      caches.open(ML_CACHE_NAME).then((cache) => {
        // Pre-cache the food database for offline access
        return fetch('/lib/db/indian-foods.json')
          .then((response) => cache.put('/lib/db/indian-foods.json', response))
          .catch(() => {
            console.log('Food database will be cached on first access');
          });
      }),
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== ML_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Special handling for food database - always cache for offline access
  if (url.pathname === '/lib/db/indian-foods.json' || url.pathname.includes('indian-foods')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            throw new Error('Invalid response');
          }
          const responseClone = response.clone();
          caches.open(ML_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          // Return empty JSON if food database unavailable
          return new Response(
            JSON.stringify({ foods: [], error: 'Offline - local cache empty' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Navigation requests - standard offline-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // All other requests - cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    })
  );
});
