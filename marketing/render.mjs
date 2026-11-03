// @ts-check
/**
 * Renders the marketing slides: starts the app, screenshots its screens in WebKit at phone size
 * against the made-up data in fixtures.mjs, drops those screenshots into the slide HTML and
 * renders each slide to a PNG in marketing/out. Run with `npm run slides`.
 *
 *   npm run slides                 every screen, then every slide
 *   npm run slides -- --slides     the slides only, from the screens already in .cache/shots
 *   npm run slides -- --only=go    one screen (by name), then every slide
 *
 * Needs the network the first time for fonts, bird photos (Wikipedia) and map tiles
 * (OpenStreetMap); photos and tiles are cached in marketing/.cache after that.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { webkit, devices } from '@playwright/test'
import { NOW, IMG_HOST, SPECIES, NOTABLE, ROUTES, answer, setRoad } from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const CACHE = join(HERE, '.cache')
const SHOTS = join(CACHE, 'shots')
const OUT = join(HERE, 'out')
const SLIDES = join(HERE, 'slides')
const UA_HEADERS = { 'User-Agent': 'bird-alert-marketing-render/1.0 (https://bird-alert.vercel.app)' }

const args = process.argv.slice(2)
const slidesOnly = args.includes('--slides')
const only = args.find(a => a.startsWith('--only='))?.slice(7) ?? null

for (const dir of [SHOTS, OUT, join(CACHE, 'photos'), join(CACHE, 'tiles')]) mkdirSync(dir, { recursive: true })

// ------------------------------------------------------------------ the app

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer()
  server.unref()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    server.close(() => resolve(port))
  })
})

/** @param {number} port */
const startApp = async (port) => {
  const vite = spawn(join(ROOT, 'node_modules', '.bin', 'vite'), ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  vite.stdout.on('data', (d) => { log += d })
  vite.stderr.on('data', (d) => { log += d })
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 120; i++) {
    if (vite.exitCode !== null) throw new Error(`vite exited:\n${log}`)
    try {
      const res = await fetch(base)
      if (res.ok) return { base, stop: () => vite.kill() }
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  vite.kill()
  throw new Error(`vite did not start:\n${log}`)
}

// ------------------------------------------------------------------ outside resources, cached

/** A bird's photo: the lead image of its Wikipedia article, as the app's own server picks it. */
const photo = async (code) => {
  const file = join(CACHE, 'photos', `${code}.jpg`)
  if (existsSync(file)) return readFileSync(file)
  const title = SPECIES[code]?.[2]
  if (!title) return null
  const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers: UA_HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null)
  const src = summary?.thumbnail?.source
  if (!src) return null
  const body = await fetch(src.replace(/\/\d+px-/, '/400px-'), { headers: UA_HEADERS }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
    ?? await fetch(src, { headers: UA_HEADERS }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
  if (!body) return null
  const buf = Buffer.from(body)
  writeFileSync(file, buf)
  return buf
}

/** An OpenStreetMap tile (the app's own tile server), cached so later renders don't ask again. */
const tile = async (url) => {
  const m = /\/(\d+)\/(\d+)\/(\d+)\.png/.exec(url)
  if (!m) return null
  const file = join(CACHE, 'tiles', `${m[1]}-${m[2]}-${m[3]}.png`)
  if (existsSync(file)) return readFileSync(file)
  const body = await fetch(url, { headers: UA_HEADERS }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
  if (!body) return null
  const buf = Buffer.from(body)
  writeFileSync(file, buf)
  return buf
}

/**
 * The drive along real roads (OSRM's public router, which the app's own server also uses for
 * drives), so a route line follows the roads and its times are believable. Cached.
 */
const roads = async () => {
  const file = join(CACHE, 'roads.json')
  /** @type {Record<string, any>} */
  const cache = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  for (const points of ROUTES()) {
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';')
    if (!cache[coords]) {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { headers: UA_HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null)
      const route = res?.routes?.[0]
      if (!route) { console.warn('no road route; using the estimate'); continue }
      const min = (s) => Math.round(s / 60)
      const mi = (m) => Math.round(m / 1609.344 * 10) / 10
      cache[coords] = {
        minutes: min(route.duration), miles: mi(route.distance),
        legs: route.legs.map(l => ({ minutes: min(l.duration), miles: mi(l.distance) })),
        // Every few points is plenty for a phone-sized map.
        geometry: route.geometry.coordinates.filter((_, i, all) => i % 4 === 0 || i === all.length - 1).map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5])
      }
      writeFileSync(file, JSON.stringify(cache))
    }
    setRoad(points, cache[coords])
  }
}

// ------------------------------------------------------------------ one page of the app

const FREEZE_CSS = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  /* Leaflet fades tiles in by the clock, and the clock is frozen: show them outright. */
  .leaflet-tile { opacity: 1 !important; }
  /* Element shots scroll the page; the sticky bar would sit over them. */
  nav { position: static !important; }
  .Toastify, #bmc-wbtn, #bmc-iframe { display: none !important; }
`

/**
 * A page with every API call answered from the fixtures, Date frozen at NOW, motion off.
 * @param {import('@playwright/test').BrowserContext} context
 */
const newPage = async (context) => {
  const page = await context.newPage()
  // The clock starts at NOW and runs from there, so the app's own timers and Leaflet's map moves still work.
  await page.clock.install({ time: new Date(NOW) })
  await page.addInitScript((css) => {
    // A first visit: no persisted queries, and the last visit long enough ago that today's reports are New.
    try {
      localStorage.clear()
      localStorage.setItem('lastVisit', String(Date.parse('2026-04-24T21:00:00-04:00')))
    } catch { /* fine */ }
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = css
      document.head.appendChild(style)
    })
  }, FREEZE_CSS)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const body = answer(new URL(req.url()), req.method())
    if (body === undefined && req.method() !== 'GET') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body ?? []) })
  })
  await page.route(`${IMG_HOST}/**`, async (route) => {
    const code = new URL(route.request().url()).pathname.slice(1).replace(/\.jpg$/, '')
    const buf = await photo(code)
    return buf ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: buf }) : route.fulfill({ status: 404, body: '' })
  })
  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    const buf = await tile(route.request().url())
    return buf ? route.fulfill({ status: 200, contentType: 'image/png', body: buf }) : route.fulfill({ status: 404, body: '' })
  })
  await page.route('https://cdnjs.buymeacoffee.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  await page.route('**/_vercel/**', (route) => route.fulfill({ status: 204, body: '' }))
  return page
}

/** Fonts loaded, every image decoded, map tiles in, and a beat for layout to settle. */
const settle = async (page) => {
  await page.evaluate(async () => {
    await document.fonts.ready
    // Lazy images below the fold never load; wait for the rest, and never for long.
    const imgs = [...document.images].filter(img => img.loading !== 'lazy' || img.getBoundingClientRect().top < innerHeight)
    const loaded = Promise.all(imgs.map(img => img.complete ? null : new Promise(r => { img.addEventListener('load', r); img.addEventListener('error', r) })))
    await Promise.race([loaded, new Promise(r => setTimeout(r, 10000))])
  })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
  await page.waitForTimeout(400)
}

// ------------------------------------------------------------------ the screens

/**
 * Each screen: where to go, what to do there, and what to capture. `shot` returns the PNGs to keep.
 * @typedef {{ name: string, path: string, iphone?: boolean, ready: string, before?: (page: import('@playwright/test').Page) => Promise<void>, shot?: (page: import('@playwright/test').Page) => Promise<Record<string, Buffer>> }} Screen
 */

/** The phone's whole screen, from the top of the page (or from a scroll position). */
const viewport = (name) => async (page) => ({ [name]: await page.screenshot() })
/** One element, as it sits on the page. */
const element = (name, selector) => async (page) => ({ [name]: await page.locator(selector).first().screenshot() })

/** A rare report's own page, in the area it was reported in. */
const sightingPath = (code) => `/sighting/${code}/${NOTABLE.find(o => o.speciesCode === code)?.subId}?region=US-AZ-003`

/** @type {Screen[]} */
const SCREENS = [
  {
    name: 'home', path: '/', ready: '.birds-list .card img', shot: viewport('home')
  },
  {
    name: 'alerts', path: '/?region=US-AZ-003', ready: '#notable',
    before: async (page) => { await page.click('#notable'); await page.waitForSelector('.alerts-list .alert-card[data-aba="5"]') },
    shot: async (page) => {
      const out = {}
      const cards = page.locator('.alerts-list .alerts-item')
      for (let i = 0; i < await cards.count(); i++) out[`alert-${i + 1}`] = await cards.nth(i).screenshot()
      return out
    }
  },
  {
    name: 'sighting-confirmed', path: sightingPath('earque'), ready: '.evidence--full',
    shot: async (page) => ({ ...await viewport('sighting-confirmed')(page), 'evidence-confirmed': await page.locator('.evidence--full').locator('xpath=..').screenshot() })
  },
  {
    name: 'sighting-unconfirmed', path: sightingPath('pinfly1'), ready: '.evidence--full',
    shot: async (page) => ({ ...await viewport('sighting-unconfirmed')(page), 'evidence-unconfirmed': await page.locator('.evidence--full').locator('xpath=..').screenshot() })
  },
  {
    name: 'proof', path: '/settings?tab=alerts', ready: '.alert-range__proof', shot: element('proof', '.alert-range__proof')
  },
  {
    name: 'go', path: '/go', ready: '.go__route',
    shot: async (page) => ({ ...await viewport('go')(page), 'go-route': await page.locator('.go__route').screenshot() })
  },
  {
    name: 'best', path: '/go?tab=best&species=camwar&sort=reliable', ready: '.best__list li',
    shot: async (page) => ({ ...await viewport('best')(page), 'best-list': await page.locator('.best__list').screenshot() })
  },
  {
    name: 'scouting', path: '/events/7', ready: '[data-testid="scout-place"]',
    before: async (page) => { await page.locator('[data-testid="event-scouting"]').scrollIntoViewIfNeeded() },
    shot: element('scouting', '[data-testid="event-scouting"]')
  },
  {
    name: 'route', path: '/events/7#route', ready: '[data-testid="route-stop"]',
    shot: async (page) => ({
      route: await page.locator('[data-testid="event-scouting"]').screenshot(),
      people: await page.locator('.event-detail__people').screenshot()
    })
  },
  {
    name: 'install', path: '/settings?tab=alerts', iphone: true, ready: '.install-group', shot: element('install', '.install-group')
  }
]

const shootScreens = async () => {
  await roads()
  const port = await freePort()
  const app = await startApp(port)
  const browser = await webkit.launch()
  try {
    const iphone = devices['iPhone 14']
    const base = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: 'America/New_York', locale: 'en-US', reducedMotion: /** @type {const} */ ('reduce'), serviceWorkers: /** @type {const} */ ('block'), baseURL: app.base }
    // A Home Screen app on iPhone, so settings show push and not the install steps; a Safari tab for the install steps.
    const android = await browser.newContext({ ...base, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36' })
    const safari = await browser.newContext({ ...base, userAgent: iphone.userAgent })
    for (const screen of SCREENS) {
      if (only && screen.name !== only) continue
      const page = await newPage(screen.iphone ? safari : android)
      await page.goto(screen.path)
      await page.waitForSelector(screen.ready, { timeout: 20_000 })
      if (screen.before) await screen.before(page)
      await settle(page)
      const shots = await (screen.shot ?? viewport(screen.name))(page)
      for (const [name, buf] of Object.entries(shots)) writeFileSync(join(SHOTS, `${name}.png`), buf)
      console.log(`screen ${screen.name}: ${Object.keys(shots).join(', ')}`)
      await page.close()
    }
  } finally {
    await browser.close()
    app.stop()
  }
}

// ------------------------------------------------------------------ the slides

const renderSlides = async () => {
  const browser = await webkit.launch()
  try {
    const files = readdirSync(SLIDES).filter(f => f.endsWith('.html')).sort()
    for (const file of files) {
      const story = file.startsWith('story')
      const context = await browser.newContext({ viewport: { width: 1080, height: story ? 1920 : 1350 }, deviceScaleFactor: 1 })
      const page = await context.newPage()
      await page.goto(pathToFileURL(join(SLIDES, file)).href)
      await settle(page)
      const broken = await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.getAttribute('src')))
      if (broken.length) throw new Error(`${file}: images missing: ${broken.join(', ')} (run without --slides to shoot the screens)`)
      const out = join(OUT, file.replace(/\.html$/, '.png'))
      await page.screenshot({ path: out })
      console.log(`slide ${out.slice(ROOT.length + 1)}`)
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

if (!slidesOnly) await shootScreens()
await renderSlides()
