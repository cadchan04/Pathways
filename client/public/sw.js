self.addEventListener('push', event => {
    let data;
    try {
     data = event.data.json();
    } catch {
        data = { title: 'Notification', body: event.data.text() };
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/images/PathwaysNotifications.png',
            data: { url: data.url || '/' }
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});