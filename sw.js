const CACHE_NAME = 'skincare-v3';
const ASSETS = [
  '/index.html',
  '/css/app.css',
  '/js/db.js',
  '/js/settings.js',
  '/js/app.js',
  '/js/home.js',
  '/js/streaks.js',
  '/js/products.js',
  '/js/journal.js',
  '/js/schedule.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Reminder notifications
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/index.html'));
});
