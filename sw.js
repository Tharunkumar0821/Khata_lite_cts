/* Keeps the app working with no signal once it has been opened once.
   Cache first: the shop's counter often has no bars, and the app never
   needs the network for anything anyway. */

const CACHE = 'khata-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(FILES.map(f => c.add(new Request(f, {cache:'reload'})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  ev.respondWith(
    caches.match(req, {ignoreSearch:true}).then(hit => {
      if (hit) return hit;
      return fetch(req)
        .then(res => {
          /* keep a copy of anything same-origin we fetched successfully */
          if (res && res.ok && new URL(req.url).origin === self.location.origin){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          /* offline and not cached: a page request still gets the app */
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', {status:503, statusText:'Offline'});
        });
    })
  );
});
