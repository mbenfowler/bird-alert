import { browseTo, stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

// Someone who signed up without a county: setup starts by asking where they bird.
const NO_AREA = { ...TEST_USER, onboarded_at: null, hasPasskey: true, state: '', location: '' }
const LONDON = { location: 'GB-ENG-LND', state: 'GB-ENG', country: 'GB', name: 'London', label: 'London, England, United Kingdom', countyWord: 'county' }

// The phone's location, as a test stands it in: a point, or a refusal.
const atPoint = (lat, lng) => ({ onBeforeLoad: (win) => cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((ok) => ok({ coords: { latitude: lat, longitude: lng, accuracy: 30 } })) })
const refused = { onBeforeLoad: (win) => cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((_ok, fail) => fail({ code: 1, message: 'User denied Geolocation' })) }

describe('Area picker', () => {
  beforeEach(() => {
    stubAuth({ loggedIn: true, user: NO_AREA })
    cy.intercept('GET', '**/api/ebird/notable*', { body: [] })
    cy.intercept('GET', '**/api/ebird/arriving*', { body: { learning: false, arrivals: [] } })
    cy.intercept('PATCH', '**/api/user', (req) => req.reply({ statusCode: 200, body: { ...NO_AREA, ...req.body } })).as('patch')
  })

  it('use my location: a point anywhere becomes its eBird area, shown to confirm, and setup saves it', () => {
    cy.intercept('GET', '**/api/ebird/area-at*', { body: LONDON }).as('areaAt')
    cy.visit('http://localhost:3000/welcome', atPoint(51.5072, -0.1276))
    cy.contains('h1', 'Where do you bird?')
    cy.get('.onboard__next').should('be.disabled')
    cy.contains('button', 'Use my location').click()
    // Only a rounded point goes to the server, and it isn't kept there.
    cy.wait('@areaAt').its('request.url').should('include', 'lat=51.5072').and('include', 'lng=-0.1276')
    cy.contains('.area-picker__results button', 'London, England, United Kingdom').should('contain', 'Tap to use this county').click()
    cy.get('.onboard__picked').should('contain', 'London, England, United Kingdom')
    cy.get('.onboard__next').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { state: 'GB-ENG', location: 'GB-ENG-LND' })
    cy.contains('h1', 'Tap the birds you’d love to see')
  })

  it('a refused location falls back to search: a town anywhere, its area offered by name', () => {
    cy.intercept('GET', '**/api/ebird/area-search*', { body: { areas: [{ ...LONDON, place: 'Westminster, London' }] } }).as('search')
    cy.visit('http://localhost:3000/welcome', refused)
    cy.contains('button', 'Use my location').click()
    cy.contains('.area-picker__note', 'Couldn’t get your location. Search for your town instead.')
    cy.focused().should('have.attr', 'type', 'search')
    cy.focused().type('Westminster{enter}')
    cy.wait('@search').its('request.url').should('include', 'q=Westminster')
    cy.contains('.place-search__results button', 'London, England, United Kingdom').should('contain', 'via Westminster, London').click()
    cy.get('.onboard__next').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { state: 'GB-ENG', location: 'GB-ENG-LND' })
  })

  it('browsing by country reaches any country eBird lists; a province without counties is the one area', () => {
    cy.intercept('GET', '**/api/ebird/regions?state=GB-ENG', { body: [{ code: 'GB-ENG-KEN', name: 'Kent' }, { code: 'GB-ENG-LND', name: 'London' }] }).as('england')
    cy.intercept('GET', '**/api/ebird/regions?state=AU-ACT', { body: [{ code: 'AU-ACT', name: 'Australian Capital Territory', whole: true }] }).as('act')
    cy.visit('http://localhost:3000/welcome')
    browseTo('United Kingdom', 'England', 'Kent')
    cy.get('.onboard__picked').should('contain', 'Kent, England, United Kingdom')
    cy.contains('.onboard__picked button', 'Change').click()
    browseTo('Australia', 'Australian Capital Territory')
    cy.wait('@act')
    cy.contains('button', 'Use all of Australian Capital Territory').click()
    cy.get('.onboard__picked').should('contain', 'Australian Capital Territory, Australia')
    cy.get('.onboard__next').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { state: 'AU-ACT', location: 'AU-ACT' })
  })
})
