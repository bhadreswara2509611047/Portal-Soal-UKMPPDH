/* Cache cadangan: jaringan selalu dicoba lebih dulu; cache dipakai bila gagal atau terlalu lambat. */
const CACHE = 'portal-ukmppdh-v3';
const CORE = ['./', './tailwind.js', './exam-theme.js', './history.js', './progress.js', './runtime.js', './github-sync.js'];
const TIMEOUT_MS = 5000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('portal-ukmppdh-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/config.json')) return;
  url.search = ''; // abaikan penanda ?t=... pada kunci cache

  const network = fetch(event.request).then(async (res) => {
    const cache = await caches.open(CACHE);
    if (res.status === 200) await cache.put(url.href, res.clone()).catch(() => {});
    else if (res.status === 404) await cache.delete(url.href); // paket yang dihapus admin
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  event.respondWith((async () => {
    const cached = await caches.match(url.href);
    if (!cached) return network;
    const slow = new Promise((resolve) => setTimeout(() => resolve(cached), TIMEOUT_MS));
    return Promise.race([network.then((res) => (res.status >= 500 ? cached : res)), slow]).catch(() => cached);
  })());
});
