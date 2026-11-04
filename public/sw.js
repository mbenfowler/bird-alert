/* Bird Alert service worker: shows push notifications, routes taps to the map app or the site, and keeps the app itself for offline use. */
const SW_VERSION = '2026-11-03.1'

// What this worker does with each notification is reported to the server (same-origin, with the
// session cookie), so a tap that goes nowhere on a phone can be read back. Best effort, never awaited alone.
const trace = (event, detail = {}) => fetch('/api/push/trace', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event, version: SW_VERSION, ua: self.navigator.userAgent, ...detail })
}).catch(() => undefined)

// ---- offline app shell ----
// The production build writes the list of every file the app is made of here (vite.config.mts,
// swPrecache): the page, every hashed chunk (lazy pages too), the icons and the fonts. In
// development it stays null and this worker leaves every request alone, as before.
const PRECACHE = null
const SHELL_PREFIX = 'bird-alert-shell-'
const SHELL_CACHE = PRECACHE ? `${SHELL_PREFIX}${PRECACHE.build}` : null
const FONT_CACHE = 'bird-alert-fonts'
const STAMP = '/__installed'
// How long a page load waits for the network before the saved copy is shown instead.
const NAVIGATION_TIMEOUT_MS = 3500

// A file already saved by the previous build (hashed chunks that did not change) is copied over
// rather than downloaded again, which matters on one bar of signal.
const saveFile = async (cache, url) => {
  const fresh = url === '/index.html'
  const known = fresh ? null : await caches.match(url)
  const response = known || await fetch(new Request(url, { cache: fresh ? 'reload' : 'no-cache' }))
  if (!response.ok) throw new Error(`precache ${url}: ${response.status}`)
  await cache.put(url, response)
}

// Google's font stylesheet names files for this browser, so it is read here and its files saved too.
// Best effort: text falls back to the system font if any of this fails.
const saveFonts = async () => {
  const cache = await caches.open(FONT_CACHE)
  await Promise.all((PRECACHE.fonts || []).map(async (href) => {
    const sheet = await fetch(href, { mode: 'cors' })
    if (!sheet.ok) return
    const css = await sheet.clone().text()
    await cache.put(href, sheet)
    const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1])
    await Promise.all(files.map(async (file) => {
      if (await cache.match(file)) return
      const font = await fetch(file, { mode: 'cors' })
      if (font.ok) await cache.put(file, font)
    }))
  })).catch(() => undefined)
}

// All or nothing for the app itself, so a saved page never points at a chunk that was not saved.
// If it fails (weak signal), this worker is dropped and the one already running carries on; the
// app asks for an update on every launch.
const precache = async () => {
  const cache = await caches.open(SHELL_CACHE)
  for (let attempt = 0; ; attempt += 1) {
    try {
      await Promise.all(PRECACHE.urls.map((url) => saveFile(cache, url)))
      break
    } catch (error) {
      if (attempt >= 1) throw error
    }
  }
  await cache.put(STAMP, new Response(String(Date.now())))
  await saveFonts()
}

// The current build's files, plus the previous build's: a page opened before this update keeps
// working (its lazy chunks are still here) until it is next launched. Older builds go.
const cleanup = async () => {
  const names = (await caches.keys()).filter((name) => name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE)
  const stamped = await Promise.all(names.map(async (name) => {
    const stamp = await (await caches.open(name)).match(STAMP)
    return { name, at: stamp ? Number(await stamp.text()) || 0 : 0 }
  }))
  stamped.sort((a, b) => b.at - a.at)
  await Promise.all(stamped.slice(1).map(({ name }) => caches.delete(name)))
}

// Same as vercel.json's rewrite: these paths are the app; the rest are files or the backend.
const APP_PATH = /^\/(?!api\/|api$|assets\/|images\/|sounds\/|share\/|robots\.txt|sitemap\.xml|sw\.js|google[\w-]*\.html)/

const shell = async () => (await (await caches.open(SHELL_CACHE)).match('/index.html')) || caches.match('/index.html')

// Network first, so a new release shows as soon as there is signal; the saved page after a short
// wait, or at once when there is no network at all. The late network answer is simply dropped.
const navigation = async (request) => {
  const network = fetch(request)
  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, NAVIGATION_TIMEOUT_MS, null) })
  const answer = await Promise.race([network.catch(() => null), timeout])
  clearTimeout(timer)
  if (answer) return answer
  const saved = await shell()
  return saved || network
}

// Hashed files never change under the same name: the saved copy, else the network (and save it).
const cacheFirst = async (request, cacheName) => {
  const saved = await caches.match(request, { ignoreVary: true })
  if (saved) return saved
  const response = await fetch(request)
  if (response.ok) {
    const copy = response.clone()
    caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => undefined)
  }
  return response
}

// Icons, sounds and the manifest keep their names across releases: the saved copy now, a fresh one for next time.
const staleWhileRevalidate = async (request, event) => {
  const saved = await caches.match(request)
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) await (await caches.open(SHELL_CACHE)).put(request, response.clone())
    return response
  })
  if (saved) { event.waitUntil(refresh.catch(() => undefined)); return saved }
  return refresh
}

if (PRECACHE) {
  self.addEventListener('fetch', (event) => {
    const { request } = event
    if (request.method !== 'GET') return
    const url = new URL(request.url)
    if (url.origin === self.location.origin) {
      // Never the API: the app keeps its own data for offline use (src/queryClient.ts).
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return
      if (request.mode === 'navigate') {
        if (APP_PATH.test(url.pathname)) event.respondWith(navigation(request))
        return
      }
      if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request, SHELL_CACHE))
      if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/sounds/') || url.pathname === '/manifest.json') return event.respondWith(staleWhileRevalidate(request, event))
      return
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(cacheFirst(request, FONT_CACHE))
  })
}

// A new worker takes over at once (so push changes reach phones quickly), but the open page is
// never reloaded: it keeps running on its own build, whose files stay saved (see cleanup), and the
// new build shows on the next launch.
self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (PRECACHE) event.waitUntil(precache())
})
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([self.clients.claim(), trace('activate'), PRECACHE ? cleanup().catch(() => undefined) : undefined])))

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
