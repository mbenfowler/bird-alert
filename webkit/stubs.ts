import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

const FIXTURES = join(__dirname, '..', 'cypress', 'fixtures')
const fixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'))

export const USER = {
  id: 1, username: '', email: 'robinware456@gmail.com', location: 'US-GA-139', state: 'GA', email_confirmed: true,
  alert_digest_email_enabled: true, rare_sightings_email_enabled: true, push_watchlist_enabled: true, push_notable_enabled: false,
  push_notable_batched: false, push_first_of_season: false, migration_email_enabled: false, push_quiet_start: 22, push_quiet_end: 6,
  timezone: 'America/New_York', created_at: '2023-11-21T19:33:34.829Z', updated_at: '2023-12-01T23:13:41.118Z'
}

/** A long, unbreakable place name of the kind eBird hotspots have; the width bugs needed one. */
export const LONG_PLACE = 'Lake Lanier--Olympic Rowing Venue (Clarks Bridge Park, north shore boat ramp and picnic area)'

/** Every API call the pages make, answered from the Cypress fixtures, as a signed-in user. */
export const stubApi = async (page: Page) => {
  const recent = fixture('recentBirds') as Array<Record<string, unknown>>
  const first = recent.find((o) => o.subId === 'S155544243')!
  const speciesRows = [
    { ...first, subId: 'S155544998', locName: LONG_PLACE, howMany: 1200, lat: (first.lat as number) + 0.03, lng: (first.lng as number) - 0.02 },
    first
  ]
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname
    if (p.endsWith('/api/auth/me')) return route.fulfill(json(USER))
    if (p.endsWith('/api/user') && route.request().method() === 'PATCH') return route.fulfill(json({ ...USER, ...route.request().postDataJSON() }))
    if (p.endsWith('/api/saved') && url.searchParams.get('kind') === 'route') return route.fulfill(json({ region: url.searchParams.get('region'), stops: null, start: null, updatedAt: null }))
    if (p.endsWith('/api/saved')) return route.fulfill(json([{ ...fixture('cangoo'), id: 1 }]))
    if (p.endsWith('/api/birds')) {
      const codes = (url.searchParams.get('codes') ?? '').split(',').filter(Boolean)
      const byCode: Record<string, unknown> = { cangoo: fixture('cangoo'), snogoo: fixture('snogoo'), rosgoo: fixture('rosgoo'), mutswa: fixture('mutswa'), tunswa: fixture('tunswa'), buwtea: fixture('buwtea'), swagoo1: fixture('swagoo1') }
      return route.fulfill(json(codes.map((c) => byCode[c]).filter(Boolean)))
    }
    if (p.endsWith('/api/ebird/species-list')) return route.fulfill(json(fixture('birdCodes')))
    if (p.endsWith('/api/ebird/observations')) return route.fulfill(json(recent))
    if (p.endsWith('/api/ebird/species-observations')) return route.fulfill(json(speciesRows))
    if (p.endsWith('/api/ebird/arriving')) return route.fulfill(json(fixture('arrivals')))
    if (p.endsWith('/api/ebird/seasonality')) return route.fulfill(json(fixture('seasonality')))
    if (p.endsWith('/api/ebird/where-to-go')) return route.fulfill(json(fixture('whereToGo')))
    if (p.endsWith('/api/ebird/nearby')) return route.fulfill(json(fixture('nearby')))
    if (p.endsWith('/api/ebird/where')) return route.fulfill(json(fixture('where')))
    if (p.endsWith('/api/ebird/regions')) return route.fulfill(json([{ code: 'US-GA-139', name: 'Hall' }]))
    if (p.endsWith('/api/ebird/notable')) return route.fulfill(json([]))
    if (p.endsWith('/api/push/public-key')) return route.fulfill(json({ publicKey: 'BFakeKeyForTests' }))
    if (p.endsWith('/api/push/pending')) return route.fulfill(json({ push: null }))
    if (p.endsWith('/api/push/status')) return route.fulfill(json({ subscribed: false, devices: 0, lastRun: null }))
    if (p.endsWith('/api/sound')) return route.fulfill(json({ speciesCode: 'cangoo', found: false }))
    if (route.request().method() === 'POST') return route.fulfill({ status: 204, body: '' })
    return route.fulfill(json([]))
  })
  // Map tiles never leave the machine.
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: readFileSync(join(FIXTURES, 'tile.png')) }))
}
