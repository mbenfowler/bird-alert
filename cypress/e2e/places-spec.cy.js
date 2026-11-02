import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const DENVER = 'US-CO-031'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const colorado = () => ({ id: 7, name: 'Colorado (work)', state: 'CO', location: DENVER, range_mi: 30, home_lat: null, home_lng: null, targets: ['clanut'] })

// Counties for Georgia (home) and Colorado (the place), whichever state is asked for.
const stubRegions = () => cy.intercept('GET', '**/api/ebird/regions*', (req) => {
  const state = new URL(req.url).searchParams.get('state')
  req.reply({ statusCode: 200, body: state === 'CO' ? [{ code: DENVER, name: 'Denver' }, { code: 'US-CO-013', name: 'Boulder' }] : [{ code: 'US-GA-139', name: 'Hall' }, { code: 'US-GA-121', name: 'Fulton' }] })
}).as('regions')

const stubBirds = () => cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [
  { speciesCode: 'clanut', comName: "Clark's Nutcracker", sciName: 'Nucifraga columbiana', birdImg: null },
  { speciesCode: 'stejay', comName: "Steller's Jay", sciName: 'Cyanocitta stelleri', birdImg: null }
] }).as('birds')

describe('Places and exploring', () => {
  it('explores another area from a link without touching the account, and comes back', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    cy.intercept('GET', '**/api/ebird/observations*').as('observations')
    cy.visit(`http://localhost:3000/?region=${DENVER}`)
    cy.get('.area-banner').should('contain', 'Exploring').and('contain', 'Denver County')
    cy.wait('@observations').its('request.url').should('include', `region=${DENVER}`)
    // Moving to Where to go keeps exploring, and says so.
    cy.visit('http://localhost:3000/go')
    cy.get('.area-banner').should('contain', 'Denver County')
    cy.contains('.area-banner button', 'Back to Hall County').click()
    cy.get('.area-banner').should('not.exist')
    cy.url().should('not.include', 'region=')
    cy.get('@patchUser.all').should('have.length', 0)
  })

  it('picks an area to explore, then saves it as a place with the area filled in', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    cy.intercept('GET', '**/api/ebird/area-search*', { statusCode: 200, body: { areas: [{ location: DENVER, state: 'CO', country: 'US', name: 'Denver', label: 'Denver, Colorado, United States', countyWord: 'county' }] } }).as('areaSearch')
    cy.visit('http://localhost:3000/')
    cy.contains('button', 'Explore another area').click()
    cy.get('.area-banner__picker input').type('denver{enter}')
    cy.wait('@areaSearch')
    cy.contains('.area-banner__picker button', 'Denver County').click()
    cy.url().should('include', `region=${DENVER}`)
    cy.get('.area-banner').should('contain', 'Exploring')
    cy.contains('.area-banner button', 'Save this place').click()
    cy.url().should('include', `/settings?addPlace=${DENVER}`)
    cy.intercept('POST', '**/api/saved?kind=place', { statusCode: 201, body: colorado() }).as('postPlace')
    cy.get('.place-form').should('contain', 'Denver County')
    cy.get('.place-form input[name="name"]').type('Colorado (work)')
    cy.contains('.place-form button', 'Save place').click()
    cy.wait('@postPlace').its('request.body').should('deep.equal', { name: 'Colorado (work)', state: 'CO', location: DENVER, range_mi: 30 })
    cy.get('@patchUser.all').should('have.length', 0)
  })

  it('lists places with targets; switches to one, adds a suggested target for the coming two weeks', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [colorado()] }).as('getPlaces')
    cy.intercept('GET', '**/api/saved?kind=place-suggestions*', { statusCode: 200, body: { from: day(0), to: day(14), sampled: 40, suggestions: [{ speciesCode: 'stejay', comName: "Steller's Jay", days: 9, sampled: 40 }] } }).as('suggestions')
    cy.intercept('PUT', '**/api/saved?kind=place-targets*', (req) => req.reply({ statusCode: 200, body: { ...colorado(), targets: req.body.codes } })).as('targets')
    cy.visit('http://localhost:3000/settings?tab=places')
    cy.get('#places').scrollIntoView()
    cy.contains('.place__what', 'Colorado (work)').should('contain', 'Denver County')
    cy.get('.place__chip').should('contain', "Clark's Nutcracker")
    cy.wait('@suggestions').its('request.url').should('include', `from=${day(0)}`).and('include', `to=${day(14)}`)
    cy.contains('.place__chip--add', "Steller's Jay").click()
    cy.wait('@targets').its('request.body').should('deep.equal', { codes: ['clanut', 'stejay'] })
    // I'm here now.
    cy.contains('.place button', "I'm here now").click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { active_place_id: 7 })
    // Keep home alerts while away.
    cy.get('#keep_home_alerts').click({ force: true })
    cy.wait('@patchUser').its('request.body').should('deep.equal', { keep_home_alerts: false })
  })

  it('at a place, the home screen shows it until asked for home', () => {
    const activePlace = { id: 7, name: 'Colorado (work)', state: 'CO', location: DENVER, via: 'manual' }
    stubAuth({ loggedIn: true, user: { ...TEST_USER, activePlace } })
    stubRegions()
    cy.intercept('GET', '**/api/ebird/observations*').as('observations')
    cy.visit('http://localhost:3000/')
    cy.get('.area-banner--place').should('contain', 'Colorado (work)').and('contain', 'Denver County')
    cy.wait('@observations').its('request.url').should('include', `region=${DENVER}`)
    cy.contains('.area-banner button', 'Show home').click()
    cy.get('.area-banner').should('contain', 'Showing home').and('contain', 'Hall County')
    cy.contains('.area-banner button', 'Back to Colorado (work)').click()
    cy.get('.area-banner--place').should('exist')
  })

  it('a place switched on by hand offers Back home', () => {
    const activePlace = { id: 7, name: 'Colorado (work)', state: 'CO', location: DENVER, via: 'manual' }
    stubAuth({ loggedIn: true, user: { ...TEST_USER, activePlace } })
    stubRegions()
    cy.visit('http://localhost:3000/')
    cy.contains('.area-banner button', 'Back home').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { active_place_id: null })
  })

  it("a place's own seen list, what counts as new there, and trip emails", () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [{ ...colorado(), seenCount: 2, lifers_scope: 'life' }] }).as('getPlaces')
    cy.intercept('GET', '**/api/saved?kind=place-suggestions*', { statusCode: 200, body: { suggestions: [] } }).as('suggestions')
    cy.intercept('GET', '**/api/saved?kind=place-seen*', { statusCode: 200, body: ['clanut', 'stejay'] }).as('seen')
    cy.intercept('PUT', '**/api/saved?kind=place-seen*', (req) => req.reply({ statusCode: 200, body: req.body.codes })).as('putSeen')
    cy.intercept('PATCH', '**/api/saved?kind=place&id=7', (req) => req.reply({ statusCode: 200, body: { ...colorado(), ...req.body } })).as('patchPlace')
    cy.visit('http://localhost:3000/settings?tab=places')
    cy.get('#places').scrollIntoView()
    cy.get('.place__seen').should('contain', 'Seen in Colorado (work) · 2 birds')
    cy.contains('.place__seen button', 'See the list').click()
    cy.wait('@seen')
    cy.get('.place__chip--seen').should('have.length', 2)
    cy.get(`.place__chip--seen button[aria-label="Remove Steller's Jay"]`).click()
    cy.wait('@putSeen').its('request.body').should('deep.equal', { codes: ['clanut'] })
    // New for me: in this place.
    cy.contains('.place__scope label', 'In Colorado (work)').click()
    cy.wait('@patchPlace').its('request.body').should('deep.equal', { lifers_scope: 'place' })
    // Trip emails.
    cy.get('#trip_emails_enabled').click({ force: true })
    cy.wait('@patchUser').its('request.body').should('deep.equal', { trip_emails_enabled: false })
  })
})
