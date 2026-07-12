// Suyog Support Hub PWA Service Worker
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Suyog Support Hub', body: event.data ? event.data.text() : 'New update' };
  }

  const title = data.title || 'Suyog Support Hub';
  const options = {
    body: data.body || 'We have an update for you.',
    icon: '/apple-icon.png',
    badge: '/apple-icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
