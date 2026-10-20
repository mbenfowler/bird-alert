export const TEST_USER = {
  id: 1,
  username: '',
  email: 'robinware456@gmail.com',
  phone: '555-555-5556',
  location: 'US-GA-139',
  state: 'GA',
  email_confirmed: true,
  alert_digest_email_enabled: true,
  rare_sightings_email_enabled: true,
  created_at: '2023-11-21T19:33:34.829Z',
  updated_at: '2023-12-01T23:13:41.118Z'
}

// Stubs every network call the app makes on the way from /login to a loaded home page.
export const login = () => {
  let loggedIn = false
  const birdsByCode = {}

  cy.fixture('birdCodes').then((codes) => {
    codes.forEach((code) => cy.fixture(code).then((bird) => { birdsByCode[code] = bird }))
  })

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

  cy.intercept('GET', '**/api/saved', { statusCode: 200, fixture: 'savedBirds' }).as('getSaved')

  // Our own bird records, looked up by species code; order of the request is preserved.
  cy.intercept('GET', '**/api/birds?codes=*', (req) => {
    const codes = new URL(req.url).searchParams.get('codes').split(',')
    req.reply({ statusCode: 200, body: codes.map((code) => birdsByCode[code]).filter(Boolean) })
  }).as('getBirds')

  cy.intercept('GET', 'https://api.ebird.org/v2/product/spplist/US-GA-139', { statusCode: 200, fixture: 'birdCodes' }).as('birdCodes')
  cy.intercept('GET', 'https://api.ebird.org/v2/data/obs/US-GA-139/recent', { statusCode: 200, fixture: 'recentBirds' }).as('recentBirds')
  cy.intercept('GET', 'https://api.ebird.org/v2/data/obs/US-GA-139/recent/notable*', { statusCode: 200, body: [] }).as('notableBirds')
  cy.intercept('GET', 'https://api.ebird.org/v2/data/obs/US-GA-139/recent/*', { statusCode: 200, body: [] }).as('lastObserved')

  cy.visit('http://localhost:3000/')
  cy.get('.input').type('robinware456@gmail.com{enter}')
  cy.get(':nth-child(2) > .input', { timeout: 10000 }).should('be.visible')
  cy.get(':nth-child(2) > .input').type('1234{enter}')
}
