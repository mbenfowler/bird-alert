import type { BrowserContext, Route } from '@playwright/test'

const COCHISE = 'US-AZ-003'
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date())

export const USER = {
  id: 1, username: '', email: 'matt@example.com', location: 'US-AZ-013', state: 'AZ', email_confirmed: true,
  alert_digest_email_enabled: true, rare_sightings_email_enabled: true, push_watchlist_enabled: true, push_notable_enabled: false,
  push_notable_batched: false, push_first_of_season: false, migration_email_enabled: false, push_quiet_start: 22, push_quiet_end: 6,
  timezone: 'America/Phoenix', onboarded_at: '2026-01-01T00:00:00Z', created_at: '2023-11-21T19:33:34.829Z', updated_at: '2023-12-01T23:13:41.118Z'
}

/** A photo URL on Wikipedia's host, which the service worker keeps (answered here, never fetched). */
export const PHOTO = (code: string) => `https://upload.wikimedia.org/wikipedia/commons/${code}.jpg`

const BIRDS = [
  { speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: PHOTO('eletro') },
  { speciesCode: 'heptan', comName: 'Hepatic Tanager', sciName: 'Piranga flava', birdImg: PHOTO('heptan') },
  { speciesCode: 'mexchi', comName: 'Mexican Chickadee', sciName: 'Poecile sclateri', birdImg: PHOTO('mexchi') },
  { speciesCode: 'rivhum1', comName: 'Rivoli’s Hummingbird', sciName: 'Eugenes fulgens', birdImg: null },
  { speciesCode: 'arizwo', comName: 'Arizona Woodpecker', sciName: 'Dryobates arizonae', birdImg: null }
]

export interface TallyPost { species_code: string; client_id?: string; observed_at?: string; lat?: number; lng?: number }
export interface TallyRow {
  id: number
  code: string
  added_by_name: string
  added_by_you?: boolean
  added_at: string
  observed_at: string
  lat?: number | null
  lng?: number | null
  stop_index?: number | null
  stop_name?: string | null
  removed?: boolean
}

/** The group's saved route for the day: a meeting point in Sierra Vista and five canyon stops. */
export const DAY_PLAN = {
  start: { name: 'Sierra Vista Walmart', lat: 31.55, lng: -110.3, time: '05:30' as string | null },
  stops: [
    { locId: 'L100', name: 'Ramsey Canyon Preserve', lat: 31.4466, lng: -110.3066, stay_min: 45, suggested_stay_min: 40 },
    { locId: 'L200', name: 'Carr Canyon', lat: 31.4325, lng: -110.2671, stay_min: null, suggested_stay_min: 30 },
    { locId: 'L300', name: 'Miller Canyon', lat: 31.4159, lng: -110.2766, stay_min: 30, suggested_stay_min: 30 },
    { locId: 'L400', name: 'Ash Canyon', lat: 31.3920, lng: -110.2400, stay_min: 20, suggested_stay_min: 20 },
    { locId: 'L500', name: 'San Pedro House', lat: 31.5487, lng: -110.1340, stay_min: 30, suggested_stay_min: 30 }
  ],
  version: 3, updated_by_name: 'Matt', updated_by_you: true,
  legs: [{ min: 20, mi: 9 }, { min: 15, mi: 5 }, { min: 10, mi: 3 }, { min: 10, mi: 3 }, { min: 30, mi: 18 }],
  totals: { drive_min: 85, stay_min: 155, total_min: 240 }, routed: true
}

/** The suggestion, which says which targets were reported at each place this week. */
export const DAY_ROUTE = {
  from: { lat: 31.55, lng: -110.3 },
  stops: [
    { n: 1, locId: 'L100', locName: 'Ramsey Canyon Preserve', lat: 31.4466, lng: -110.3066, new_birds: [{ code: 'eletro', comName: 'Elegant Trogon' }, { code: 'rivhum1', comName: 'Rivoli’s Hummingbird' }], species: ['eletro', 'rivhum1', 'heptan'], leg_min: 20, leg_mi: 9, suggested_stay_min: 40 },
    { n: 2, locId: 'L200', locName: 'Carr Canyon', lat: 31.4325, lng: -110.2671, new_birds: [{ code: 'mexchi', comName: 'Mexican Chickadee' }], species: ['mexchi'], leg_min: 15, leg_mi: 5, suggested_stay_min: 30 }
  ],
  extras: [], total_min: 35, total_mi: 14, covered: 3, reported: 4, skipped: 0, geometry: [], routed: true,
  names: { eletro: 'Elegant Trogon', rivhum1: 'Rivoli’s Hummingbird', mexchi: 'Mexican Chickadee', heptan: 'Hepatic Tanager' }
}

/**
 * A stateful stand-in for the backend: one Big Day today (event 2, Cochise County) with a tally the
 * POST and DELETE change. `network` decides, per request, whether it gets through: 'up', 'down'
 * (every request fails as with no signal) or a function for finer control (weak signal).
 */
export const fakeApi = async (context: BrowserContext) => {
  const state = {
    loggedIn: true,
    nextId: 10,
    tally: [{ id: 1, code: 'eletro', added_by_name: 'Jane', added_at: new Date(Date.now() - 3600_000).toISOString(), observed_at: new Date(Date.now() - 3600_000).toISOString() }] as TallyRow[],
    /** Tally ids ticked as on Matt's eBird checklist. */
    marks: new Set<number>(),
    posts: [] as TallyPost[],
    /** Every request to the API, as "METHOD kind". */
    calls: [] as string[],
    /** The group's saved route and the suggestion; none until a test sets them. */
    plan: { start: null, stops: null, version: 0 } as unknown,
    route: { from: null, stops: [], extras: [], total_min: null, total_mi: null, covered: 0, reported: 0, skipped: 0, geometry: [], routed: false } as unknown,
    /** Where the group is on its route (event-route-plan's position): the latest tap wins. */
    position: null as null | { stop: number; at: string; by_name: string; by_you: boolean },
    /** Every position tap that reached the server, and every route PUT. */
    positionPosts: [] as Array<{ stop: number | null; at: string }>,
    planPuts: [] as Array<Record<string, unknown>>,
    /** Return 'fail' to drop a request (as one bar of signal does), or nothing to answer it. */
    interfere: null as null | ((route: Route) => 'fail' | void),
    meFails: false,
    /** What the service worker reported (POST /api/push/trace): 'activate', 'push', … */
    traces: [] as Array<{ event: string; title?: string }>
  }
  const shown = () => state.tally.filter(e => !e.removed).sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .map(({ removed: _removed, ...e }) => ({ ...e, marked_by_me: state.marks.has(e.id) }))
  const event = () => ({
    id: 2, name: 'Cochise Big Day', state: 'AZ', location: COCHISE, range_mi: 30, starts_on: today(), ends_on: today(), kind: 'bigday',
    scout: false, active: true, tally_open: true, timezone: 'America/Phoenix', role: 'organizer', display_name: 'Matt',
    members: [{ display_name: 'Matt', role: 'organizer', you: true }, { display_name: 'Jane', role: 'member' }, { display_name: 'Sam', role: 'member' }],
    targets: [{ code: 'eletro' }, { code: 'heptan' }, { code: 'mexchi' }, { code: 'rivhum1' }],
    tally: shown(), invite_url: '/events/join/inv', view_url: '/events/view/view2'
  })
  const log = () => [...state.tally].sort((a, b) => a.observed_at.localeCompare(b.observed_at) || a.id - b.id).map(e => ({
    id: e.id, speciesCode: e.code, comName: BIRDS.find(b => b.speciesCode === e.code)?.comName ?? e.code, by_name: e.added_by_name,
    observed_at: e.observed_at, stop_index: e.stop_index ?? null, stop_name: e.stop_name ?? null, removed: Boolean(e.removed)
  }))
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await context.route('**/api/**', async (route) => {
    if (state.interfere?.(route) === 'fail') return route.abort('internetdisconnected')
    const request = route.request()
    const url = new URL(request.url())
    const kind = url.searchParams.get('kind')
    const method = request.method()
    state.calls.push(`${method} ${kind ?? url.pathname}`)
    if (url.pathname.endsWith('/api/auth/me')) {
      if (state.meFails) return route.abort('connectionreset')
      return route.fulfill(state.loggedIn ? json(USER) : json({ error: 'Not logged in' }, 401))
    }
    if (url.pathname.endsWith('/api/birds')) {
      const codes = (url.searchParams.get('codes') ?? '').split(',')
      return route.fulfill(json(BIRDS.filter(b => codes.includes(b.speciesCode))))
    }
    if (url.pathname.endsWith('/api/ebird/species-list') || url.pathname.includes('/api/ebird/species')) return route.fulfill(json(BIRDS.map(b => b.speciesCode)))
    if (url.pathname.endsWith('/api/saved')) {
      if (kind === 'events' && method === 'GET') return route.fulfill(json([event()]))
      if (kind === 'event-tally' && method === 'POST') {
        const body = request.postDataJSON() as TallyPost
        state.posts.push(body)
        const existing = state.tally.find(e => e.code === body.species_code)
        if (existing) existing.removed = false
        else state.tally.push({ id: state.nextId++, code: body.species_code, added_by_name: 'Matt', added_by_you: true, added_at: new Date().toISOString(), observed_at: body.observed_at ?? new Date().toISOString(), lat: body.lat ?? null, lng: body.lng ?? null })
        return route.fulfill(json(event()))
      }
      if (kind === 'event-tally' && method === 'DELETE') {
        const row = state.tally.find(e => e.code === url.searchParams.get('code'))
        if (row) row.removed = true
        return route.fulfill(json(event()))
      }
      if (kind === 'event-tally-undo' && method === 'POST') {
        const code = (request.postDataJSON() as { species_code: string }).species_code
        const row = state.tally.find(e => e.code === code)
        if (!row) return route.fulfill(json({ error: 'That bird isn’t on the tally' }, 404))
        row.removed = false
        return route.fulfill(json(event()))
      }
      if (kind === 'event-tally-mark') {
        const id = Number(method === 'POST' ? (request.postDataJSON() as { tally_id: number }).tally_id : url.searchParams.get('tally_id'))
        if (method === 'POST') state.marks.add(id)
        else state.marks.delete(id)
        return route.fulfill(json(event()))
      }
      if (kind === 'event-log') return route.fulfill(json(log()))
      if (kind === 'event-scouting') return route.fulfill(json({ using: 'targets', reported: [], unreported: [] }))
      if (kind === 'event-route-plan' && method === 'PUT') {
        const body = request.postDataJSON() as Record<string, unknown> & { version: number }
        state.planPuts.push(body)
        const current = (state.plan as { version?: number }).version ?? 0
        if (body.version !== current) return route.fulfill(json({ error: 'Changed', current: { ...(state.plan as object), position: state.position } }, 409))
        state.plan = { ...(state.plan as object), start: body.start, stops: body.stops, version: current + 1, updated_by_name: 'Matt', updated_by_you: true, updated_at: new Date().toISOString() }
        return route.fulfill(json({ ...(state.plan as object), position: state.position }))
      }
      if (kind === 'event-route-plan' && method === 'DELETE') {
        state.plan = { start: null, stops: null, version: 0 }
        return route.fulfill(json({ ...(state.plan as object), position: state.position }))
      }
      if (kind === 'event-route-plan') return route.fulfill(json({ ...(state.plan as object), position: state.position }))
      if (kind === 'event-route-position' && method === 'POST') {
        const body = request.postDataJSON() as { stop: number | null; at: string }
        state.positionPosts.push(body)
        // The server keeps whichever tap is latest by its own time, not by arrival.
        if (!state.position || body.at >= state.position.at) state.position = body.stop === null ? null : { stop: body.stop, at: body.at, by_name: 'Matt', by_you: true }
        return route.fulfill(json({ ...(state.plan as object), position: state.position }))
      }
      if (kind === 'event-route') return route.fulfill(json(state.route))
      if (kind === 'event-view') return route.fulfill(json({ name: 'Cochise Big Day', kind: 'bigday', starts_on: today(), ends_on: today(), area: 'Cochise', targets: [], tally: [] }))
      if (kind === 'seen' || kind === 'places') return route.fulfill(json([]))
      return route.fulfill(json([]))
    }
    if (url.pathname.endsWith('/api/ebird/regions')) return route.fulfill(json([{ code: COCHISE, name: 'Cochise' }, { code: 'US-AZ-013', name: 'Maricopa' }]))
    if (url.pathname.endsWith('/api/push/trace')) { state.traces.push(request.postDataJSON() as { event: string }); return route.fulfill({ status: 204, body: '' }) }
    if (url.pathname.endsWith('/api/push/pending')) return route.fulfill(json({ push: null }))
    if (url.pathname.endsWith('/api/push/status')) return route.fulfill(json({ subscribed: false, devices: 0, lastRun: null }))
    if (method === 'POST') return route.fulfill({ status: 204, body: '' })
    return route.fulfill(json([]))
  })
  // Third parties never leave the machine; the font stylesheet answers like Google's (CORS allowed).
  await context.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: '/* fonts */' }))
  await context.route('https://fonts.gstatic.com/**', (route) => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' }))
  await context.route('https://cdnjs.buymeacoffee.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  // A 1×1 GIF for every bird photo.
  await context.route('https://upload.wikimedia.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }))
  await context.route(/\/_vercel\//, (route) => route.fulfill({ status: 204, body: '' }))
  await context.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204, body: '' }))
  return state
}

/**
 * No signal at all: the browser reports offline (navigator.onLine false), and every request,
 * the service worker's own included, fails before reaching the preview server.
 */
const APP_FILES = new RegExp(`localhost:${Number(process.env.OFFLINE_PORT) || 4317}/(?!api/)`)
const THIRD_PARTIES = /upload\.wikimedia\.org/
export const goOffline = async (context: BrowserContext) => {
  await context.setOffline(true)
  await context.route(APP_FILES, (route) => route.abort('internetdisconnected'))
  await context.route(THIRD_PARTIES, (route) => route.abort('internetdisconnected'))
}

export const goOnline = async (context: BrowserContext) => {
  await context.unroute(APP_FILES)
  await context.unroute(THIRD_PARTIES)
  await context.setOffline(false)
}
