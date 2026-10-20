/* Bird Alert service worker: shows push notifications and focuses the app when one is clicked. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.title || 'Bird Alert'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/images/bird.png',
    badge: '/images/bird.png',
    tag: data.tag || 'bird-alert',
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' }
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((w) => w.url.startsWith(self.location.origin))
    if (existing) return existing.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : w))
    return self.clients.openWindow(url)
  }))
})
