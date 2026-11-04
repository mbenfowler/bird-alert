import type { BrowserContext, Route } from '@playwright/test'

const COCHISE = 'US-AZ-003'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date())

export const USER = {
  id: 1, username: '', email: 'matt@example.com', location: 'US-AZ-013', state: 'AZ', email_confirmed: true,
  alert_digest_email_enabled: true, rare_sightings_email_enabled: true, push_watchlist_enabled: true, push_notable_enabled: false,
  push_notable_batched: false, push_first_of_season: false, migration_email_enabled: false, push_quiet_start: 22, push_quiet_end: 6,
  timezone: 'America/Phoenix', onboarded_at: '2026-01-01T00:00:00Z', created_at: '2023-11-21T19:33:34.829Z', updated_at: '2023-12-01T23:13:41.118Z'
}

const BIRDS = [
  { speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: null },
  { speciesCode: 'heptan', comName: 'Hepatic Tanager', sciName: 'Piranga flava', birdImg: null },
  { speciesCode: 'mexchi', comName: 'Mexican Chickadee', sciName: 'Poecile sclateri', birdImg: null }
]

export interface TallyPost { species_code: string; client_id?: string }

/**
 * A stateful stand-in for the backend: one Big Day today (event 2, Cochise County) with a tally the
 * POST and DELETE change. `network` decides, per request, whether it gets through: 'up', 'down'
 * (every request fails as with no signal) or a function for finer control (weak signal).
 */
export const fakeApi = async (context: BrowserContext) => {
  const state = {
    loggedIn: true,
    tally: [{ code: 'eletro', added_by_name: 'Jane', added_at: new Date(Date.now() - 3600_000).toISOString() }] as Array<{ code: string; added_by_name: string; added_by_you?: boolean; added_at: string }>,
    posts: [] as TallyPost[],
    /** Return 'fail' to drop a request (as one bar of signal does), or nothing to answer it. */
    interfere: null as null | ((route: Route) => 'fail' | void),
    meFails: false,
    /** What the service worker reported (POST /api/push/trace): 'activate', 'push', … */
    traces: [] as Array<{ event: string; title?: string }>
  }
  const event = () => ({
    id: 2, name: 'Cochise Big Day', state: 'AZ', location: COCHISE, range_mi: 30, starts_on: today(), ends_on: today(), kind: 'bigday',
    scout: false, active: true, role: 'organizer', display_name: 'Matt',
    members: [{ display_name: 'Matt', role: 'organizer', you: true }, { display_name: 'Jane', role: 'member' }],
    targets: [{ code: 'eletro' }, { code: 'heptan' }, { code: 'mexchi' }],
    tally: state.tally, invite_url: '/events/join/inv', view_url: '/events/view/view2'
  })
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await context.route('**/api/**', async (route) => {
    if (state.interfere?.(route) === 'fail') return route.abort('internetdisconnected')
    const request = route.request()
    const url = new URL(request.url())
    const kind = url.searchParams.get('kind')
    const method = request.method()
    if (url.pathname.endsWith('/api/auth/me')) {
      if (state.meFails) return route.abort('connectionreset')
      return route.fulfill(state.loggedIn ? json(USER) : json({ error: 'Not logged in' }, 401))
    }
    if (url.pathname.endsWith('/api/birds')) {
      const codes = (url.searchParams.get('codes') ?? '').split(',')
      return route.fulfill(json(BIRDS.filter(b => codes.includes(b.speciesCode))))
    }
    if (url.pathname.endsWith('/api/saved')) {
      if (kind === 'events' && method === 'GET') return route.fulfill(json([event()]))
      if (kind === 'event-tally' && method === 'POST') {
        const body = request.postDataJSON() as TallyPost
        state.posts.push(body)
        if (!state.tally.some(e => e.code === body.species_code)) state.tally = [{ code: body.species_code, added_by_name: 'Matt', added_by_you: true, added_at: new Date().toISOString() }, ...state.tally]
        return route.fulfill(json(event()))
      }
      if (kind === 'event-tally' && method === 'DELETE') {
        state.tally = state.tally.filter(e => e.code !== url.searchParams.get('code'))
        return route.fulfill({ status: 204, body: '' })
      }
      if (kind === 'event-scouting') return route.fulfill(json({ using: 'targets', reported: [], unreported: [] }))
      if (kind === 'event-route-plan') return route.fulfill(json({ start: null, stops: null, version: 0 }))
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
  await context.route(/\/_vercel\//, (route) => route.fulfill({ status: 204, body: '' }))
  await context.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204, body: '' }))
  return state
}

/**
 * No signal at all: the browser reports offline (navigator.onLine false), and every request,
 * the service worker's own included, fails before reaching the preview server.
 */
const APP_FILES = /localhost:4317\/(?!api\/)/
export const goOffline = async (context: BrowserContext) => {
  await context.setOffline(true)
  await context.route(APP_FILES, (route) => route.abort('internetdisconnected'))
}

export const goOnline = async (context: BrowserContext) => {
  await context.unroute(APP_FILES)
  await context.setOffline(false)
}
