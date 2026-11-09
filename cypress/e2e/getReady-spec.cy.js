import { stubAuth } from '../support/stubs'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const eventIn = (days) => ({
  id: 7, name: 'Cochise Big Day', state: 'AZ', location: COCHISE, range_mi: 30, home_lat: 31.5, home_lng: -110,
  starts_on: day(days), ends_on: day(days), kind: 'bigday', scout: false, active: false,
  role: 'organizer', members: [{ display_name: 'Matt', role: 'organizer', you: true }],
  targets: [{ code: 'eletro' }], tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456'
})

const routed = {
  from: null,
  stops: [{ n: 1, locId: 'L200', locName: 'Ramsey Canyon', lat: 31.45, lng: -110.3, new_birds: [], leg_min: null, leg_mi: null }],
  total_min: 0, total_mi: 0, covered: 1, reported: 1, skipped: 0, geometry: [], routed: true
}
const BIRDS = [
  { speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: 'https://img.test/eletro.jpg' },
  { speciesCode: 'heptan', comName: 'Hepatic Tanager', sciName: 'Piranga flava', birdImg: 'https://img.test/heptan.jpg' },
  { speciesCode: 'mexchi', comName: 'Mexican Chickadee', sciName: 'Poecile sclateri', birdImg: 'https://img.test/mexchi.jpg' }
]

const open = (days, store = {}) => {
  cy.viewport(390, 844)
  stubAuth({ loggedIn: true })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/ebird/species-list*', { statusCode: 200, body: ['eletro', 'heptan', 'mexchi'], delay: 800 }).as('species')
  cy.intercept('GET', '**/api/birds*', (req) => {
    const codes = String(req.query.codes ?? req.query.speciesCodes ?? '').split(',')
    req.reply({ statusCode: 200, body: BIRDS.filter(b => codes.includes(b.speciesCode)) })
  })
  cy.intercept('GET', 'https://img.test/**', { statusCode: 200, body: '' })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [eventIn(days)] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: { checked_at: new Date().toISOString(), days_to_go: days, using: 'targets', reported: [], unreported: [] } })
  cy.intercept('GET', '**/api/saved?kind=event-route*', { statusCode: 200, body: routed })
  cy.intercept('GET', '**/api/saved?kind=event-route-plan*', { statusCode: 200, body: { start: { name: 'Sierra Vista', lat: 31.55, lng: -110.3, time: '05:30' }, stops: null, version: 1 } })
  cy.intercept('GET', '**/api/saved?kind=event-log*', { statusCode: 200, body: { entries: [] } })
  cy.visit('/events/7', { onBeforeLoad: (win) => { for (const [key, value] of Object.entries(store)) win.localStorage.setItem(key, value) } })
}

describe('Get ready for offline: the checklist', () => {
  it('shows the week before: a checklist, one button that says each step, then what saved', () => {
    open(6)
    cy.get('[data-testid="get-ready"] h2').should('have.text', 'Get ready for offline')
    cy.get('[data-testid="ready-status"]').should('have.text', 'Not saved yet. Save while you have signal.')
    cy.get('[data-testid="get-ready-button"]').should('have.text', 'Save for offline')
    cy.get('[data-testid="ready-list"] li').should('have.length', 5)
    cy.get('[data-testid="ready-line-tally"]').should('have.attr', 'data-done', 'false').and('contain', '☐').and('contain', 'Tally search')
    cy.get('[data-testid="ready-line-app"]').should('contain', 'App saved to this phone')
    cy.get('[data-testid="ready-map-note"]').should('have.text', 'The map inside Bird Alert needs signal. With no signal, use your maps app’s offline map.')

    cy.get('[data-testid="get-ready-button"]').click()
    cy.get('[data-testid="ready-status"]').should('have.text', 'Saving 2 of 4: tally search…')
    cy.get('[data-testid="get-ready-button"]').should('be.disabled')
    cy.wait('@species')
    cy.get('[data-testid="get-ready-button"]').should('not.be.disabled')
    cy.get('[data-testid="ready-line-event"]').should('have.attr', 'data-done', 'true').and('contain', '✓').and('contain', 'Event, route, scouting & group log')
    cy.get('[data-testid="ready-line-tally"]').should('have.attr', 'data-done', 'true').and('contain', 'Tally search: 3 county birds')
    // The dev server's worker doesn't keep the app, so the app line names what to do and nothing is stamped.
    cy.get('[data-testid="ready-line-app"]').should('have.attr', 'data-done', 'false').and('contain', 'open the app once more with signal')
    cy.get('[data-testid="ready-status"]').should('have.text', 'Not all saved yet: see the lines above.')
    cy.window().then(win => expect(win.localStorage.getItem('bird-alert:event-ready:7')).to.equal(null))
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(390))
  })

  it('a save over a week old asks for an update', () => {
    open(3, { 'bird-alert:event-ready:7': String(Date.now() - 8 * 24 * 60 * 60 * 1000) })
    cy.get('[data-testid="ready-status"]').should('contain', 'over 7 days ago · update it with signal')
    cy.get('[data-testid="get-ready-button"]').should('have.text', 'Update').and('have.class', 'pill-button--primary')
  })

  it('a fresh save says how long it lasts', () => {
    open(1, { 'bird-alert:event-ready:7': String(Date.now() - 60 * 60 * 1000) })
    cy.get('[data-testid="ready-status"]').invoke('text').should('match', /^Saved .+ · good for 7 days, until \w{3}, \w{3} \d{1,2}$/)
    cy.get('[data-testid="get-ready-button"]').should('have.text', 'Update')
  })

  it('more than a week out, it waits', () => {
    open(9)
    cy.contains('h1', 'Cochise Big Day')
    cy.get('[data-testid="get-ready"]').should('not.exist')
  })
})
