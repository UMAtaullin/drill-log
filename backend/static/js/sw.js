const CACHE_NAME = 'drilling-journal-v2';
const urlsToCache = [
  '/',
  '/static/manifest.json',
  '/static/js/app.js',
  // Кешируем основные страницы
  '/api/wells/',
  '/api/layers/',
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Для API запросов - сначала сеть, потом кеш
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Клонируем ответ для кеширования
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // Если офлайн - ищем в кеше
          return caches.match(event.request);
        })
    );
  } else {
    // Для статики - сначала кеш, потом сеть
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});