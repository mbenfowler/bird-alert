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

/** Licences a photo may carry here: attribution-only or share-alike Creative Commons, or none needed. */
const FREE = /^(CC BY(-SA)? \d(\.\d)?( [A-Za-z-]+)?|CC0( 1\.0)?|Public domain)$/i
const getJson = (url) => fetch(url, { headers: UA_HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null)
const plain = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/**
 * Commons' record for some files: the author, the licence and a 400 px copy. Files whose licence
 * isn't one we can credit and reuse (CC BY, CC BY-SA, CC0, public domain) come back null.
 * @param {string[]} titles  "File:…" titles
 */
const commons = async (titles) => {
  if (!titles.length) return []
  const res = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&titles=${encodeURIComponent(titles.join('|'))}`)
  /** @type {any[]} */
  const pages = Object.values(res?.query?.pages ?? {})
  return titles.map(title => pages.find(p => p.title === title.replace(/_/g, ' ')))
    .map(page => {
      const info = page?.imageinfo?.[0]
      const meta = info?.extmetadata ?? {}
      const license = plain(meta.LicenseShortName?.value)
      if (!info?.thumburl || !FREE.test(license)) return null
      const author = plain(meta.Artist?.value) || 'Unknown author'
      return { file: page.title, url: info.descriptionurl, src: info.thumburl, author, license, licenseUrl: meta.LicenseUrl?.value ?? null }
    })
}

/**
 * A bird's photo: the lead image of its Wikipedia article, as the app's own server picks it, as
 * long as its licence lets us reuse it with a credit; otherwise the article's next photo that does.
 * The image and its credit are cached side by side (photos/<code>.jpg and .json).
 */
const photo = async (code) => {
  const file = join(CACHE, 'photos', `${code}.jpg`)
  const credit = join(CACHE, 'photos', `${code}.json`)
  if (existsSync(file) && existsSync(credit)) return readFileSync(file)
  const title = SPECIES[code]?.[2]
  if (!title) return null
  const page = encodeURIComponent(title.replace(/ /g, '_'))
  const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`)
  const lead = summary?.originalimage?.source ?? summary?.thumbnail?.source
  const leadTitle = lead ? `File:${decodeURIComponent(lead.split('?')[0].split('/').filter(Boolean).pop().replace(/^\d+px-/, ''))}` : null
  let pick = leadTitle ? (await commons([leadTitle]))[0] : null
  if (!pick) {
    // The lead photo isn't free to reuse: the article's other photos, in order.
    const list = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=images&imlimit=50&titles=${page}&redirects=1`)
    /** @type {any[]} */
    const listed = Object.values(list?.query?.pages ?? {})
    const files = listed.flatMap(p => p.images ?? []).map(i => i.title)
      .filter(t => /\.jpe?g$/i.test(t) && !/map|range|distribution|egg|skull|stamp/i.test(t))
    pick = (await commons(files.slice(0, 40))).find(Boolean) ?? null
    if (pick) console.log(`photo ${code}: lead image not free to reuse; using ${pick.file}`)
  }
  if (!pick) { console.warn(`photo ${code}: no freely licensed photo found`); return null }
  const body = await fetch(pick.src, { headers: UA_HEADERS }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
  if (!body) return null
  const buf = Buffer.from(body)
  writeFileSync(file, buf)
  const { file: commonsFile, url, author, license, licenseUrl } = pick
  writeFileSync(credit, JSON.stringify({ code, bird: SPECIES[code][0], file: commonsFile, url, author, license, licenseUrl }, null, 2))
  return buf
}

/** The credit for a photo already fetched, or null. */
const photoCredit = (code) => {
  const file = join(CACHE, 'photos', `${code}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

/**
 * Audubon's Birds of America plates (the Havell edition, 1827–38; public domain), shown on some
 * slides as old prints. Scans from Wikimedia Commons. Slides use them as ../.cache/plates/<key>.jpg.
 */
const PLATES = [
  { key: 'carolina-parakeet', bird: 'Carolina Parakeet', plate: 26, file: 'File:26 Carolina Parrot.jpg' },
  { key: 'painted-bunting', bird: 'Painted Bunting', plate: 53, file: 'File:53 Painted Finch.jpg' },
  { key: 'ivory-billed-woodpecker', bird: 'Ivory-billed Woodpecker', plate: 66, file: 'File:66 Ivory-billed Woodpecker.jpg' },
  { key: 'snowy-owl', bird: 'Snowy Owl', plate: 121, file: 'File:121 Snowy Owl.jpg' },
  { key: 'roseate-spoonbill', bird: 'Roseate Spoonbill', plate: 321, file: 'File:321 Roseate Spoonbill.jpg' }
]

/** Downloads each plate once (1200 px wide), only if Commons says it is in the public domain. */
const plates = async () => {
  mkdirSync(join(CACHE, 'plates'), { recursive: true })
  const out = []
  for (const p of PLATES) {
    const img = join(CACHE, 'plates', `${p.key}.jpg`)
    const meta = join(CACHE, 'plates', `${p.key}.json`)
    if (!existsSync(img) || !existsSync(meta)) {
      const res = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&titles=${encodeURIComponent(p.file)}`)
      /** @type {any} */
      const page = Object.values(res?.query?.pages ?? {})[0]
      const info = page?.imageinfo?.[0]
      const license = plain(info?.extmetadata?.LicenseShortName?.value)
      if (!info?.thumburl) throw new Error(`plate ${p.key}: not found on Commons`)
      if (!/public domain|^PD/i.test(license)) throw new Error(`plate ${p.key}: licence is "${license}", not public domain`)
      const body = await fetch(info.thumburl, { headers: UA_HEADERS }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
      if (!body) throw new Error(`plate ${p.key}: download failed`)
      writeFileSync(img, Buffer.from(body))
      writeFileSync(meta, JSON.stringify({ ...p, url: info.descriptionurl, license }, null, 2))
    }
    out.push(JSON.parse(readFileSync(meta, 'utf8')))
  }
  return out
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
  /* No focus rings: a hash link or a click can leave one, depending on timing. */
  *:focus, *:focus-visible { outline: none !important; box-shadow: none !important; }
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

/**
 * Stops the page's clock at exactly NOW + STOP_AFTER_MS, wherever it had got to, so everything
 * captured (relative times like "14 minutes ago", New marks) is the same on every render. The
 * clock runs until then because Leaflet times its map moves by Date and never settles without it.
 */
const STOP_AFTER_MS = 55_000
const stopClock = async (page) => {
  // No hover or focus left on whatever was last clicked or scrolled to.
  await page.mouse.move(1, 1)
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
  const stopAt = Date.parse(NOW) + STOP_AFTER_MS
  const now = await page.evaluate(() => Date.now())
  if (now >= stopAt) throw new Error(`the page took over ${STOP_AFTER_MS / 1000}s of its own time to load; raise STOP_AFTER_MS`)
  await page.clock.pauseAt(new Date(stopAt))
  // Let the frame after the jump paint, and give WebKit time to repaint scaled images at full
  // quality (it draws them fast first and sharpens them on a timer of its own).
  await page.waitForTimeout(1500)
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
const viewport = (name) => async (page) => {
  // Which bird photos are on this screen, for the slide's credit line.
  // Where each is (CSS px down the screen), so a slide can credit only the ones it really shows.
  const photos = await page.evaluate((host) => [...document.images]
    .filter(img => img.src.startsWith(host) && img.naturalWidth)
    .map(img => ({ img, r: img.getBoundingClientRect() }))
    .filter(({ r }) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)
    .map(({ img, r }) => ({ code: new URL(img.src).pathname.slice(1).replace(/\.jpg$/, ''), top: Math.round(r.top) })), IMG_HOST)
  writeFileSync(join(SHOTS, `${name}.photos.json`), JSON.stringify(photos))
  return { [name]: await page.screenshot() }
}
/** One element, as it sits on the page, with a little of the page around it (`pad` CSS px). */
const shoot = async (page, selector, pad = 12) => {
  const box = await page.locator(selector).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } })
  const x = Math.max(0, box.x - pad)
  return page.screenshot({ fullPage: true, clip: { x, y: Math.max(0, box.y - pad), width: Math.min(390 - x, box.width + pad * 2), height: box.height + pad * 2 } })
}
const element = (name, selector) => async (page) => ({ [name]: await shoot(page, selector) })

/** A rare report's own page, in the area it was reported in. */
const sightingPath = (code) => `/sighting/${code}/${NOTABLE.find(o => o.speciesCode === code)?.subId}?region=US-AZ-003`

/** @type {Screen[]} */
const SCREENS = [
  {
    name: 'home', path: '/', ready: '.birds-list .card img', shot: viewport('home')
  },
  {
    name: 'alerts', path: '/?region=US-AZ-003', ready: '#notable',
    before: async (page) => {
      await page.click('#notable')
      await page.waitForSelector('.alerts-list .alert-card[data-aba="5"]')
      // The cards are shot one by one, so lay the row out as a column with nothing clipped or faded;
      // the cards themselves are drawn as the app draws them.
      await page.addStyleTag({ content: '.alerts-list { flex-direction: column; gap: 60px !important; overflow: visible !important; -webkit-mask-image: none !important; mask-image: none !important; padding: 24px !important; } .alerts-collapse, .alerts-collapse__inner, #birdAlerts { overflow: visible !important; }' })
    },
    shot: async (page) => {
      /** @type {Record<string, Buffer>} */
      const out = {}
      const cards = page.locator('.alerts-list .alerts-item')
      for (let i = 0; i < await cards.count(); i++) {
        // With a margin, so the card's heat glow fades into the grey instead of stopping at a hard edge.
        // boundingBox is viewport-relative; a full-page clip wants page coordinates.
        const box = await cards.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } })
        if (!box) continue
        const pad = 18
        out[`alert-${i + 1}`] = await page.screenshot({ fullPage: true, clip: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 } })
      }
      return out
    }
  },
  {
    name: 'sighting-confirmed', path: sightingPath('earque'), ready: '.evidence--full',
    shot: async (page) => ({ 'evidence-confirmed': await page.locator('.evidence--full').locator('xpath=..').screenshot() })
  },
  {
    name: 'sighting-unconfirmed', path: sightingPath('pinfly1'), ready: '.evidence--full',
    shot: async (page) => ({ 'evidence-unconfirmed': await page.locator('.evidence--full').locator('xpath=..').screenshot() })
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
      route: await shoot(page, '[data-testid="event-scouting"]'),
      people: await shoot(page, '.event-detail__people')
    })
  },
  {
    // The same route open for editing: the time at each stop, with its stepper.
    name: 'route-edit', path: '/events/7#route', ready: '[data-testid="route-stop"]',
    before: async (page) => {
      await page.click('.event-route__edit')
      await page.waitForSelector('[data-testid="stop-stay"]')
      // The editor's Done bar sticks to the bottom of the screen; shot whole, it belongs at the end.
      await page.addStyleTag({ content: '.go__route.is-editing .go__route-actions { position: static !important; }' })
    },
    shot: element('route-edit', '[data-testid="route-editor"]')
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
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
    for (const screen of SCREENS) {
      if (only && screen.name !== only) continue
      // A context per screen: the clock belongs to the context, and each screen stops it.
      const context = await browser.newContext({ ...base, userAgent: screen.iphone ? iphone.userAgent : android })
      const page = await newPage(context)
      await page.goto(screen.path)
      await page.waitForSelector(screen.ready, { timeout: 20_000 }).catch(async (error) => {
        await page.screenshot({ path: join(CACHE, `failed-${screen.name}.png`) })
        throw new Error(`screen ${screen.name}: ${screen.ready} never showed (see .cache/failed-${screen.name}.png)`, { cause: error })
      })
      if (screen.before) await screen.before(page)
      await settle(page)
      await stopClock(page)
      const shots = await (screen.shot ?? viewport(screen.name))(page)
      for (const [name, buf] of Object.entries(shots)) writeFileSync(join(SHOTS, `${name}.png`), buf)
      console.log(`screen ${screen.name}: ${Object.keys(shots).join(', ')}`)
      await context.close()
    }
  } finally {
    await browser.close()
    app.stop()
  }
}

// ------------------------------------------------------------------ the slides

/** The bird photos on a screen (codes), as viewport() noted them. */
const photosOn = (name) => {
  const file = join(SHOTS, `${name}.photos.json`)
  if (!existsSync(file)) throw new Error(`no photo list for screen ${name} (run without --slides)`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** "Photos via Wikimedia Commons: Scarlet Tanager by A. Birder (CC BY-SA 4.0); …" */
const creditLine = (credits) => credits.length
  ? `Photos via Wikimedia Commons: ${credits.map(c => `${c.bird} by ${c.author} (${c.license})`).join('; ')}.`
  : ''

/** Every credit the deck needs: CREDITS.md for the repository, and a block to paste into a caption. */
const writeCredits = (credits, prints) => {
  const photos = credits.map(c => `- ${c.bird}: [${c.file.replace(/^File:/, '')}](${c.url}) by ${c.author}, ${c.licenseUrl ? `[${c.license}](${c.licenseUrl})` : c.license}`)
  writeFileSync(join(HERE, 'CREDITS.md'), [
    '# Credits for the marketing slides',
    '',
    'Written by `render.mjs` on every render; edit the script, not this file.',
    '',
    '## Bird photos',
    '',
    'From Wikimedia Commons, used under their licences. The phone screens show them as the app does.',
    '',
    ...photos,
    '',
    '## Audubon plates',
    '',
    'John James Audubon, *The Birds of America* (Havell edition, 1827–38). Public domain; scans from Wikimedia Commons.',
    '',
    ...prints.map(p => `- ${p.bird} (plate ${p.plate}): [${p.file.replace(/^File:/, '')}](${p.url}), ${p.license.toLowerCase()}. On ${p.slides.join(', ')}.`),
    '',
    '## Data',
    '',
    '- Sightings and checklists come from eBird, the Cornell Lab of Ornithology (the reports on these slides are made up).',
    '- ABA Checklist codes are used with permission of the American Birding Association.',
    '- Maps: © OpenStreetMap contributors (openstreetmap.org/copyright). Drive routes from OSRM, on OpenStreetMap data.',
    ''
  ].join('\n'))
  writeFileSync(join(OUT, 'caption-credits.txt'), [
    `Photos via Wikimedia Commons: ${credits.map(c => `${c.bird} by ${c.author} (${c.license})`).join('; ')}.`,
    ...(prints.length ? [`Plates from John James Audubon’s Birds of America (public domain): ${prints.map(p => p.bird).join(', ')}.`] : []),
    'Maps © OpenStreetMap contributors. Sightings and checklists from eBird, the Cornell Lab of Ornithology. ABA Checklist codes used with permission of the American Birding Association. The sightings shown are examples.',
    ''
  ].join('\n'))
}

const renderSlides = async () => {
  /** @type {Map<string, any>} */
  const used = new Map()
  const allPlates = await plates()
  /** @type {Map<string, Set<string>>} */
  const platesUsed = new Map()
  const browser = await webkit.launch()
  try {
    const files = readdirSync(SLIDES).filter(f => f.endsWith('.html')).sort()
    for (const file of files) {
      const story = file.startsWith('story')
      const context = await browser.newContext({ viewport: { width: 1080, height: story ? 1920 : 1350 }, deviceScaleFactor: 1 })
      const page = await context.newPage()
      await page.goto(pathToFileURL(join(SLIDES, file)).href)
      await settle(page)
      // A photo is credited when the top of it shows on the slide: inside the phone's crop and the slide's edge.
      const wanted = await page.evaluate(() => [...document.querySelectorAll('[data-photos]')].map(el => el.getAttribute('data-photos')))
      const lists = Object.fromEntries(wanted.map(name => [name, photosOn(name)]))
      const shown = await page.evaluate((all) => Object.entries(all).flatMap(([name, list]) => {
        const img = /** @type {HTMLImageElement | null} */ (document.querySelector(`img[src$="/${name}.png"]`))
        if (!img) return []
        const scale = img.offsetWidth / 390
        const box = img.getBoundingClientRect()
        const clip = img.closest('.clip')?.getBoundingClientRect()
        const bottom = Math.min(innerHeight, clip ? clip.bottom : Infinity)
        return list.filter(p => box.top + (p.top + 20) * scale < bottom).map(p => p.code)
      }), lists)
      const credits = [...new Set(shown)].map(photoCredit).filter(Boolean)
      credits.forEach(c => { used.set(c.code, c) })
      await page.evaluate((line) => { document.querySelectorAll('[data-photos]').forEach(el => { el.textContent = line }) }, creditLine(credits))
      for (const src of await page.evaluate(() => [...document.querySelectorAll('.print img')].map(img => img.getAttribute('src')))) {
        const key = src.split('/').pop().replace(/\.jpg$/, '')
        if (!platesUsed.has(key)) platesUsed.set(key, new Set())
        platesUsed.get(key).add(file.replace(/\.html$/, '.png'))
      }
      const broken = await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.getAttribute('src')))
      if (broken.length) throw new Error(`${file}: images missing: ${broken.join(', ')} (run without --slides to shoot the screens)`)
      const out = join(OUT, file.replace(/\.html$/, '.png'))
      // Scaled images are repainted at full quality on WebKit's own timer; wait it out.
      await page.waitForTimeout(1500)
      await page.screenshot({ path: out })
      console.log(`slide ${out.slice(ROOT.length + 1)}`)
      await context.close()
    }
    writeCredits([...used.values()].sort((a, b) => a.bird.localeCompare(b.bird)), allPlates.filter(p => platesUsed.has(p.key)).map(p => ({ ...p, slides: [...platesUsed.get(p.key)].sort() })))
  } finally {
    await browser.close()
  }
}

if (!slidesOnly) await shootScreens()
await renderSlides()
