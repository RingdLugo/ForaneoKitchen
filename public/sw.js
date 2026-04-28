const CACHE_NAME = 'foraneanokitchen-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/home.html',
  '/login.html',
  '/planificador.html',
  '/lista-compras.html',
  '/subir-receta.html',
  '/receta.html',
  '/comunidad.html',
  '/perfil.html',
  '/css/style.css',
  '/css/home.css',
  '/css/login.css',
  '/css/planificador.css',
  '/css/lista-compras.css',
  '/css/subir-receta.css',
  '/css/receta.css',
  '/css/comunidad.css',
  '/css/perfil.css',
  '/css/dark-mode.css',
  '/js/home.js',
  '/js/login.js',
  '/js/planificador.js',
  '/js/lista-compras.js',
  '/js/subir-receta.js',
  '/js/receta.js',
  '/js/comunidad.js',
  '/js/perfil.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Error al cachear:', err))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('push', event => {
  let data = { title: 'ForananeoKitchen', body: 'Nueva notificación' };
  if (event.data) {
    data = event.data.json();
  }
  const options = {
    body: data.body,
    icon: '/images/icon-192.png',
    badge: '/images/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/home.html'
    }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/home.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (let client of windowClients) {
          if (client.url.includes(urlToOpen.replace('/', '')) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});