export const TEST_USER = {
  id: 1,
  username: '',
  email: 'robinware456@gmail.com',
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
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: 'US-GA-139', name: 'Hall' }] }).as('regions')
  cy.intercept('GET', '**/api/push/status*', { statusCode: 200, body: { subscribed: false, devices: 0, lastRun: { at: new Date(Date.now() - 14 * 60000).toISOString(), notified: 0 } } }).as('pushStatus')

  cy.visit('http://localhost:3000/')
  cy.get('.input').type('robinware456@gmail.com{enter}')
  cy.get(':nth-child(2) > .input', { timeout: 10000 }).should('be.visible')
  cy.get(':nth-child(2) > .input').type('1234{enter}')
}
