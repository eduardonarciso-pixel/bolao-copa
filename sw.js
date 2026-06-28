const CACHE = 'bolao-copa-v8';
const ARQUIVOS = [
  '/bolao-copa/',
  '/bolao-copa/index.html',
  '/bolao-copa/style.css',
  '/bolao-copa/app.js',
  '/bolao-copa/firebase-config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARQUIVOS))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
