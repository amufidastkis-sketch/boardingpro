const CACHE_NAME = 'boardingpro-shell-v6053';
const SHELL_FILES = ['./', './index.html', './app.js?v=6053', './data.js?v=6053', './style.css?v=6053', './manifest.json', './assets/logo%20stkis.png', './assets/pwa-icon-192.png', './assets/pwa-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('boardingpro-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
