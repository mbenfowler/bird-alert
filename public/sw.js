/* Bird Alert service worker: shows push notifications and routes taps to the map app or the site. */
const SW_VERSION = '2026-10-22.4'

// What this worker does with each notification is reported to the server (same-origin, with the
// session cookie), so a tap that goes nowhere on a phone can be read back. Best effort, never awaited alone.
const trace = (event, detail = {}) => fetch('/api/push/trace', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event, version: SW_VERSION, ua: self.navigator.userAgent, ...detail })
}).catch(() => undefined)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([self.clients.claim(), trace('activate')])))

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
  // An open page is told as well, so it can offer the same tap in-app while it is in the foreground.
  const title = data.title || 'Bird Alert'
  const url = options.data && options.data.url
  broadcast({ type: 'push', title, url })
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    record('/latest-push', { title, url }).then(() => true, () => false)
      .then((recorded) => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) => trace('push', { title, url, recorded, windows: windows.map((w) => ({ url: w.url, visibility: w.visibilityState, focused: w.focused })) })))
  ]))
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

// Where a tap should land is recorded before anything else, so the page can claim it when it starts
// or comes back to the foreground (see src/pendingOpen.ts). iOS Home Screen apps neither navigate an
// existing window nor reliably deliver a message to a suspended one, so no single path is trusted.
const HANDOFF_CACHE = 'bird-alert-pending-open'
const CHANNEL = 'bird-alert-notifications'
const record = (key, value) => caches.open(HANDOFF_CACHE)
  .then((cache) => cache.put(key, new Response(JSON.stringify({ ...value, at: Date.now() }), { headers: { 'Content-Type': 'application/json' } })))
  .catch(() => undefined)
const broadcast = (message) => {
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage(message); channel.close() } catch { /* no BroadcastChannel here */ }
}
const rememberTarget = (url) => { broadcast({ type: 'open', url }); return record('/pending-open', { url }) }

const openUrl = (url) => self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
  const sameOrigin = url.startsWith(self.location.origin)
  const existing = sameOrigin && windows.find((w) => w.url.startsWith(self.location.origin))
  const report = { url, windows: windows.map((w) => ({ url: w.url, visibility: w.visibilityState, focused: w.focused })), steps: [] }
  const step = (name, outcome) => report.steps.push(`${name}:${outcome}`)
  if (sameOrigin) step('remember', await rememberTarget(url).then(() => 'ok', (e) => `fail ${e && e.message}`))
  if (!existing) {
    step('openWindow', await self.clients.openWindow(url).then((w) => (w ? 'window' : 'null'), (e) => `fail ${e && e.message}`))
    return report
  }
  const client = (await existing.focus().then((w) => { step('focus', w ? 'ok' : 'null'); return w }, (e) => { step('focus', `fail ${e && e.message}`); return null })) || existing
  try { client.postMessage({ type: 'open', url }); step('postMessage', 'ok') } catch (e) { step('postMessage', `fail ${e && e.message}`) }
  if ('navigate' in client) {
    const navigated = await client.navigate(url).then(() => true, (e) => { step('navigate', `fail ${e && e.message}`); return false })
    if (navigated) { step('navigate', 'ok'); return report }
  } else step('navigate', 'unsupported')
  step('openWindow', await self.clients.openWindow(url).then((w) => (w ? 'window' : 'null'), (e) => `fail ${e && e.message}`))
  return report
})

// On iPhone the push context cannot reach the open app at all, so a tap is handed over through the
// server: the app polls /api/push/pending and follows a tapped push.
const reportTap = (url) => fetch('/api/push/tap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url })
}).catch(() => undefined)

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const started = trace('notificationclick-start', { action: event.action || '', url: data.url || null })
  const appUrl = new URL(data.url || '/', self.location.origin).href
  const hasLocation = typeof data.lat === 'number' && typeof data.lng === 'number'
  // Tap: the sighting page in the app. 'Open map': the maps app. 'View on eBird': the checklist.
  let target = appUrl
  if (event.action === 'map' && hasLocation) target = mapsUrl(data)
  if (event.action === 'ebird' && data.ebirdUrl) target = data.ebirdUrl
  const tapped = target.startsWith(self.location.origin) ? reportTap(target) : Promise.resolve()
  event.waitUntil(Promise.all([started, tapped, openUrl(target).then(
    (report) => trace('notificationclick', { action: event.action || '', ...report }),
    (error) => trace('notificationclick', { action: event.action || '', url: target, error: error && error.message })
  )]))
})
