const IMAGE_CACHE_NAME = 'clawdmate-report-images-v1';
const IMAGE_HOSTS = new Set(['oss.filenest.top']);

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isImageRequest =
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|webp|gif|avif|bmp|svg)(\?.*)?$/i.test(url.pathname);
  if (!isImageRequest) return;

  if (!IMAGE_HOSTS.has(url.hostname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const cached = await cache.match(request);

      try {
        const networkResponse = await fetch(request, { cache: 'no-store' });
        if (networkResponse) {
          // Opaque cross-origin image responses are cacheable via cache.put.
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        if (cached) return cached;
        throw new Error('image_fetch_failed');
      }
    })()
  );
});
