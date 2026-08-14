const CACHE_NAME = 'ludotheque-local-v21';
const SHELL_ASSETS = [
  './',
  './index.html',
  './hub.js?v=38',
  './shared/game-runtime.js?v=12',
  './replay.html',
  './replay.js?v=1',
  './shared/options-help.js?v=3',
  './shared/effects.js?v=3',
  './assets/hub-icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('ludotheque-local-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function cacheable(request, response) {
  if (!response?.ok || response.type === 'opaque') return false;
  const url = new URL(request.url);
  if (url.pathname.endsWith('.sf3') || request.headers.has('range')) return false;
  const size = Number(response.headers.get('content-length')) || 0;
  return !size || size < 8 * 1024 * 1024;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.headers.has('range')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (cacheable(request, response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: false }) || await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw error;
    }
  })());
});
