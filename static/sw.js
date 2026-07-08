const CACHE_NAME = 'arch-v116';

const PRECACHE = [
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/db.js',
  '/static/js/sync.js',
  '/static/js/attendance.js',
  '/static/icons/icon-72.png',
  '/static/icons/icon-96.png',
  '/static/icons/icon-128.png',
  '/static/icons/icon-144.png',
  '/static/icons/icon-152.png',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/manifest.json',
  '/static/models/tiny_face_detector_model-weights_manifest.json',
  '/static/models/tiny_face_detector_model-shard1',
  '/static/models/face_landmark_68_tiny_model-weights_manifest.json',
  '/static/models/face_landmark_68_tiny_model-shard1',
  '/static/models/face_recognition_model-weights_manifest.json',
  '/static/models/face_recognition_model-shard1',
  '/static/models/face_recognition_model-shard2',
];

const OFFLINE_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — Arch</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
min-height:100vh;margin:0;background:#f5f3ef;color:#1c1c1e;}
.box{text-align:center;padding:40px;max-width:320px;}
h2{color:#F15A24;margin-bottom:8px;}p{color:#636366;font-size:.9rem;}
button{margin-top:20px;padding:10px 24px;background:#F15A24;color:#fff;
border:none;border-radius:8px;cursor:pointer;font-size:1rem;}
</style></head><body><div class="box">
<h2>You're Offline</h2>
<p>No internet connection. Some pages may still work from cache.</p>
<button onclick="location.reload()">Try Again</button>
</div></body></html>`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // API calls: network only, return JSON error when offline
  if (url.pathname.startsWith('/api/') ||
      url.pathname === '/login' ||
      url.pathname === '/logout') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Page navigation: stale-while-revalidate (cached → instant, fetch → update cache for next visit)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(request, clone));
            }
            return res;
          })
          .catch(() => cached || new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }));
        return cached || network;
      })
    );
    return;
  }

  // Same-origin app JS/CSS: stale-while-revalidate so code updates propagate
  // after one online reload instead of being frozen by cache-first forever.
  const isAppAsset = url.origin === self.location.origin &&
    /\.(js|css)$/.test(url.pathname) && url.pathname.startsWith('/static/');

  if (isAppAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(request, clone));
            }
            return res;
          })
          .catch(() => cached || new Response('', {
            status: 503, headers: { 'Content-Type': 'text/plain' },
          }));
        // Return cache immediately if present, else wait for network
        return cached || network;
      })
    );
    return;
  }

  // Other static assets & CDN libs: cache first (these rarely change)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          new Response('', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        );
    })
  );
});
