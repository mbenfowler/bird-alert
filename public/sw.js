/* Bird Alert service worker: shows push notifications and routes taps to the map app or the site. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Only these platforms render a large picture and a useful-sized icon. Elsewhere (macOS shows a
// thumbnail too small to read, iOS shows nothing custom) the recognisable app logo is better.
const showsRichMedia = () => /Android|Windows|CrOS/i.test(self.navigator.userAgent)

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const rich = showsRichMedia()
  const options = {
    body: data.body || '',
    icon: rich && data.icon ? data.icon : '/images/bird.png',
    badge: data.badge || '/images/bird.png',
    tag: data.tag || 'bird-alert',
    renotify: Boolean(data.tag),
    data: data.data || { url: data.url || '/' }
  }
  if (rich && data.image) options.image = data.image
  if (data.actions) options.actions = data.actions
  if (data.timestamp) options.timestamp = data.timestamp
  if (data.vibrate) options.vibrate = data.vibrate
  event.waitUntil(self.registration.showNotification(data.title || 'Bird Alert', options))
})

// Apple devices get Apple Maps; everything else gets a Google Maps link, which Android hands to
// whichever maps app is the default.
const mapsUrl = ({ lat, lng, comName, locName }) => {
  const label = encodeURIComponent(`${comName || 'Bird sighting'}${locName ? ` - ${locName}` : ''}`)
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(self.navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?ll=${lat},${lng}&q=${label}&z=15`
    : `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`
}

// An open app window is reused. iOS Home Screen apps ignore WindowClient.navigate(), so the page is
// also told where to go and routes itself; where navigate() works it simply lands on the same URL.
const openUrl = (url) => self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
  const sameOrigin = url.startsWith(self.location.origin)
  const existing = sameOrigin && windows.find((w) => w.url.startsWith(self.location.origin))
  if (!existing) return self.clients.openWindow(url)
  const client = (await existing.focus().catch(() => null)) || existing
  client.postMessage({ type: 'open', url })
  if ('navigate' in client) await client.navigate(url).catch(() => undefined)
  return client
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const appUrl = new URL(data.url || '/', self.location.origin).href
  const hasLocation = typeof data.lat === 'number' && typeof data.lng === 'number'
  // Tap: the sighting page in the app. 'Open map': the maps app. 'View on eBird': the checklist.
  let target = appUrl
  if (event.action === 'map' && hasLocation) target = mapsUrl(data)
  if (event.action === 'ebird' && data.ebirdUrl) target = data.ebirdUrl
  event.waitUntil(openUrl(target))
})
