const CACHE = 'gea-vendor-v1';

// Assets to pre-cache on install
const PRECACHE = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notifications (U7). Payload is {title, body, url} — see
// src/lib/dispatch-notifications.ts sendPush. No buyer contact detail is
// ever placed in a notification body.
self.addEventListener('push', event => {
  let data = { title: 'Update on your campaign', body: '', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      icon: '/icons/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin vendor routes and static assets
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  const isVendorPage = url.pathname.startsWith('/vendor/');
  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');

  if (!isVendorPage && !isStatic) return;

  if (isStatic) {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // Network-first for vendor pages; fall back to cache when offline
  event.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
