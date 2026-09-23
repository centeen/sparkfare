self.addEventListener('push', function(event) {
  if (event.data) {
    let data = {};
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Sparkfare Alert', body: event.data.text() };
    }

    const title = data.title || 'Sparkfare Alert';
    const options = {
      body: data.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: data
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    // Open the target URL and report the click
    event.waitUntil(
      clients.openWindow(event.notification.data.url).then(() => {
        // Optionally send a beacon back to track push_click
        if (event.notification.data.trip_id) {
          fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'push_click',
              trip_id: event.notification.data.trip_id
            })
          }).catch(console.error);
        }
      })
    );
  }
});
