/* Service Worker v6:
 * - App Shell: Stale-While-Revalidate (instan dari cache, diperbarui di latar belakang)
 * - Paket Soal (/data/builtin, /data/extra, /data/packages): Cache-First on-demand + revalidasi
 * - Manifest (/data/manifest.json): Network-First timeout 2 detik agar paket baru cepat tampil
 */
const SHELL_CACHE = 'portal-ukmppdh-shell-v6';
const DATA_CACHE = 'portal-ukmppdh-data-v6';
const CORE = [
  './',
  './index.html',
  './tailwind.js',
  './exam-theme.js',
  './history.js',
  './progress.js',
  './runtime.js',
  './github-sync.js'
];
const MANIFEST_TIMEOUT_MS = 2000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const valid = new Set([SHELL_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('portal-ukmppdh-') && !valid.has(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function cleanUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.search = '';
  return url.href;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/config.json')) {
    return;
  }

  const cacheKey = cleanUrl(req.url);
  const isManifest = url.pathname.endsWith('/data/manifest.json');
  const isPackageHtml = /\/data\/(builtin|extra|packages)\//.test(url.pathname);

  if (isManifest) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const cached = await cache.match(cacheKey);
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(cacheKey, res.clone()).catch(() => {});
        return res;
      });
      if (!cached) return network;
      const slow = new Promise((resolve) => setTimeout(() => resolve(cached), MANIFEST_TIMEOUT_MS));
      return Promise.race([
        network.then((res) => (res && res.status >= 500 ? cached : res)),
        slow
      ]).catch(() => cached);
    })());
    return;
  }

  if (isPackageHtml) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const cached = await cache.match(cacheKey);
      const refresh = fetch(req).then(async (res) => {
        if (res.status === 200) await cache.put(cacheKey, res.clone()).catch(() => {});
        else if (res.status === 404) await cache.delete(cacheKey);
        return res;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) || new Response('Paket gagal dimuat saat offline.', { status: 503 });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(cacheKey);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(cacheKey, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || new Response('Offline', { status: 503 });
  })());
});
