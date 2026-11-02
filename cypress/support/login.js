export const TEST_USER = {
  id: 1,
  username: '',
  email: 'robin@example.com',
  // Already has a passkey, so signing in with the password goes straight in (no Face ID offer).
  hasPasskey: true,
  location: 'US-GA-139',
  state: 'GA',
  email_confirmed: true,
  alert_digest_email_enabled: true,
  rare_sightings_email_enabled: true,
  push_watchlist_enabled: true,
  push_notable_enabled: false,
  push_notable_batched: false,
  push_first_of_season: false,
  migration_email_enabled: false,
  push_quiet_start: 22,
  push_quiet_end: 6,
  // Match the browser running the tests, so the Alert Center does not issue a time-zone update on its own.
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  created_at: '2023-11-21T19:33:34.829Z',
  updated_at: '2023-12-01T23:13:41.118Z'
}

/**
 * Stubs every network call the app makes on the way from /login to a loaded home page.
 * The watch list is a tiny in-memory fake: GET returns the current list, POST and DELETE
 * change it, so optimistic updates and the refetch that follows them stay consistent.
 */
export const login = () => {
  let loggedIn = false
  const birdsByCode = {}
  const watchList = { birds: [] }

  cy.fixture('birdCodes').then((codes) => {
    codes.forEach((code) => cy.fixture(code).then((bird) => { birdsByCode[code] = bird }))
  })
  cy.fixture('savedBirds').then((saved) => { watchList.birds = saved })

  // Session: 401 until the stubbed login succeeds, then the user, including across full reloads.
  cy.intercept('GET', '**/api/auth/me', (req) => {
    req.reply(loggedIn ? { statusCode: 200, body: TEST_USER } : { statusCode: 401, body: { error: 'Not logged in' } })
  }).as('me')
  cy.intercept('GET', '**/api/auth/exists?*', { statusCode: 200, body: { userExists: true } }).as('userExists')
  cy.intercept('POST', '**/api/auth/login', (req) => {
    loggedIn = true
    req.reply({ statusCode: 200, body: TEST_USER })
  }).as('login')
  cy.intercept('POST', '**/api/auth/logout', { statusCode: 204, body: '' }).as('logout')

  // Watch list fake.
  cy.intercept('GET', '**/api/saved', (req) => {
    req.reply({ statusCode: 200, body: watchList.birds })
  }).as('getSaved')
  cy.intercept('POST', '**/api/saved', (req) => {
    const bird = birdsByCode[req.body.speciesCode]
    if (!watchList.birds.some((b) => b.speciesCode === bird.speciesCode)) watchList.birds = [...watchList.birds, bird]
    req.reply({ statusCode: 201, body: bird })
  }).as('postSaved')
  cy.intercept('DELETE', '**/api/saved?speciesCode=*', (req) => {
    const code = new URL(req.url).searchParams.get('speciesCode')
    watchList.birds = watchList.birds.filter((b) => b.speciesCode !== code)
    req.reply({ statusCode: 204, body: '' })
  }).as('deleteSaved')

  // The life list: empty to begin with; taps add and remove.
  const lifeList = { birds: [] }
  cy.intercept('GET', '**/api/saved?kind=seen*', (req) => req.reply({ statusCode: 200, body: lifeList.birds })).as('getSeen')
  cy.intercept('POST', '**/api/saved?kind=seen', (req) => {
    if (!lifeList.birds.some((b) => b.speciesCode === req.body.speciesCode)) lifeList.birds = [...lifeList.birds, { speciesCode: req.body.speciesCode, firstSeen: `2026-10-${String(10 + lifeList.birds.length).padStart(2, '0')}`, source: 'tap', comName: birdsByCode[req.body.speciesCode]?.comName ?? null, taxonOrder: birdsByCode[req.body.speciesCode]?.taxonOrder ?? null }]
    req.reply({ statusCode: 201, body: { speciesCode: req.body.speciesCode } })
  }).as('postSeen')
  cy.intercept('DELETE', '**/api/saved?kind=seen&speciesCode=*', (req) => {
    const code = new URL(req.url).searchParams.get('speciesCode')
    lifeList.birds = lifeList.birds.filter((b) => b.speciesCode !== code)
    req.reply({ statusCode: 204, body: '' })
  }).as('deleteSeen')
  // An eBird import: twelve birds land, and two rows come back for the person to settle.
  cy.intercept('POST', '**/api/saved?kind=seen&import=1', (req) => {
    const codes = ['snogoo', ...Array.from({ length: 11 }, (_, i) => `imp${String(i).padStart(3, '0')}`)]
    const added = codes.filter((code) => !lifeList.birds.some((b) => b.speciesCode === code))
    lifeList.birds = [...lifeList.birds, ...added.map((speciesCode) => ({ speciesCode, firstSeen: '2020-01-01', source: 'import' }))]
    req.reply({ statusCode: 200, body: { added: added.length, already: codes.length - added.length, total: lifeList.birds.length, skipped: [
      { name: 'Saltmarsh/Prairie Willet', reason: 'one of two species (often an old sighting from before eBird split it), so it’s yours to say which', choices: [{ speciesCode: 'willet2', comName: 'Saltmarsh Willet' }, { speciesCode: 'willet3', comName: 'Prairie Willet' }], where: { locId: 'L591483', region: 'US-GA', day: '2025-08-23' } },
      { name: 'Eastern/Western Warbling Vireo', reason: 'one of two species (often an old sighting from before eBird split it), so it’s yours to say which', choices: [{ speciesCode: 'eawvir1', comName: 'Eastern Warbling Vireo' }, { speciesCode: 'wewvir2', comName: 'Western Warbling Vireo' }], where: { locId: 'L342269', region: 'US-CO', day: '2024-05-25' } },
      { name: 'Muscovy Duck', reason: 'an escapee eBird doesn’t count', choices: [{ speciesCode: 'musduc', comName: 'Muscovy Duck' }] }
    ] } })
  }).as('importLifeList')
  cy.intercept('POST', '**/api/saved?kind=seen&evidence=1', (req) => {
    const vireo = req.body.choices[0].speciesCode === 'eawvir1'
    req.reply({ statusCode: 200, body: vireo
      ? { area: 'US-GA-139', areaKind: 'county', from: '05-11', to: '06-08', sampled: 10, lean: 'wewvir2', strength: 'clear', ranked: [{ speciesCode: 'wewvir2', comName: 'Western Warbling Vireo', days: 9 }, { speciesCode: 'eawvir1', comName: 'Eastern Warbling Vireo', days: 2 }] }
      : { area: 'US-GA-139', areaKind: 'county', from: '08-09', to: '09-06', sampled: 10, lean: null, strength: 'thin', ranked: [{ speciesCode: 'willet2', comName: 'Saltmarsh Willet', days: 0 }, { speciesCode: 'willet3', comName: 'Prairie Willet', days: 0 }] } })
  }).as('splitEvidence')

  // The route kept on the account: empty to begin with, and whatever was last put after that.
  const account = { stops: {}, start: null }
  cy.intercept('GET', '**/api/saved?kind=route*', (req) => {
    const region = new URL(req.url).searchParams.get('region')
    req.reply({ statusCode: 200, body: { region, stops: account.stops[region] ?? null, start: account.start, updatedAt: null } })
  }).as('getRoute')
  // No saved places unless a spec says otherwise.
  cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [] }).as('getPlaces')
  cy.intercept('PUT', '**/api/saved?kind=route*', (req) => {
    const { region, ...change } = req.body
    if ('stops' in change) account.stops[region] = change.stops
    if ('start' in change) account.start = change.start
    req.reply({ statusCode: 200, body: { region, stops: account.stops[region] ?? null, start: account.start, updatedAt: null } })
  }).as('putRoute')

  // Our own bird records, looked up by species code; order of the request is preserved.
  cy.intercept('GET', '**/api/birds?codes=*', (req) => {
    const codes = new URL(req.url).searchParams.get('codes').split(',')
    req.reply({ statusCode: 200, body: codes.map((code) => birdsByCode[code]).filter(Boolean) })
  }).as('getBirds')

  // Name search: two geese from the region plus one from elsewhere.
  cy.intercept('GET', '**/api/birds?q=*', (req) => {
    const q = new URL(req.url).searchParams.get('q').toLowerCase()
    const all = [
      { speciesCode: 'cangoo', comName: 'Canada Goose', sciName: 'Branta canadensis' },
      { speciesCode: 'snogoo', comName: 'Snow Goose', sciName: 'Anser caerulescens' },
      { speciesCode: 'emgoo1', comName: 'Emperor Goose', sciName: 'Anser canagicus' }
    ]
    req.reply({ statusCode: 200, body: all.filter((b) => b.comName.toLowerCase().includes(q)) })
  }).as('search')

  // Map tiles: a 1x1 PNG so tests never hit OpenStreetMap.
  cy.intercept('GET', 'https://tile.openstreetmap.org/**', { fixture: 'tile.png,null' }).as('tiles')

  // eBird, as proxied by the backend.
  cy.intercept('GET', '**/api/ebird/species-list?region=US-GA-139', { statusCode: 200, fixture: 'birdCodes' }).as('speciesList')
  cy.intercept('GET', '**/api/ebird/observations?region=US-GA-139', { statusCode: 200, fixture: 'recentBirds' }).as('observations')
  cy.intercept('GET', '**/api/ebird/notable*', { statusCode: 200, body: [] }).as('notable')
  // Per-species feed: only that species' rows from the fixture, as eBird would return.
  const recent = { observations: [] }
  cy.fixture('recentBirds').then((obs) => { recent.observations = obs })
  cy.intercept('GET', '**/api/ebird/species-observations*', (req) => {
    const code = new URL(req.url).searchParams.get('code')
    req.reply({ statusCode: 200, body: recent.observations.filter((o) => o.speciesCode === code) })
  }).as('speciesObservations')
  cy.intercept('GET', '**/api/ebird/arriving*', { statusCode: 200, fixture: 'arrivals' }).as('arriving')
  cy.intercept('GET', '**/api/ebird/seasonality*', { statusCode: 200, fixture: 'seasonality' }).as('seasonality')
  cy.intercept('GET', '**/api/ebird/where*', { statusCode: 200, fixture: 'where' }).as('where')
  cy.intercept('GET', '**/api/ebird/where-to-go*', { statusCode: 200, fixture: 'whereToGo' }).as('whereToGo')
  cy.intercept('GET', '**/api/ebird/nearby*', { statusCode: 200, fixture: 'nearby' }).as('nearby')
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: 'US-GA-139', name: 'Hall' }] }).as('regions')
  // Bird sounds: one stub recording for every species, as a silent clip so playback really runs.
  cy.intercept('GET', '**/api/sound?*', (req) => {
    const code = new URL(req.url).searchParams.get('code')
    req.reply({ statusCode: 200, body: { speciesCode: code, found: code !== 'emgoo1', xcId: 4242, url: 'data:audio/wav;base64,UklGRuQSAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcASAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', page: 'https://xeno-canto.org/4242', type: 'song', quality: 'A', length: 12, recordist: 'A Birder', license: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', licenseName: 'CC BY-NC-SA 4.0', country: 'United States' } })
  }).as('sound')
  cy.intercept('POST', '**/api/push/trace', { statusCode: 204, body: '' }).as('pushTrace')
  cy.intercept('GET', '**/api/push/pending', { statusCode: 200, body: { push: null } }).as('pushPending')
  cy.intercept('POST', '**/api/push/ack', { statusCode: 204, body: '' }).as('pushAck')
  cy.intercept('GET', '**/api/push/status*', { statusCode: 200, body: { subscribed: false, devices: 0, lastRun: { at: new Date(Date.now() - 14 * 60000).toISOString(), notified: 0 } } }).as('pushStatus')

  cy.visit('http://localhost:3000/login')
  cy.get('.input.email').type('robin@example.com{enter}')
  cy.get('.input.password', { timeout: 10000 }).should('be.visible')
  cy.get('.input.password').type('1234{enter}')
}
