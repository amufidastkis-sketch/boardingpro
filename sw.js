<<<<<<< HEAD
const CACHE_NAME = 'boardingpro-shell-v6005';
const SHELL_FILES = ['./', './index.html', './app.js?v=6005', './data.js?v=6005', './manifest.json'];
=======
const CACHE_NAME = 'boardingpro-shell-v2';
const SHELL_FILES = ['./', './index.html', './app.js?v=999?v=101', './data.js?v=999?v=101', './manifest.json', './assets/logo%20stkis.png'];
>>>>>>> 18518bd (Update splash screen logo to logo stkis with white background container)

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
<<<<<<< HEAD
=======


>>>>>>> 18518bd (Update splash screen logo to logo stkis with white background container)
