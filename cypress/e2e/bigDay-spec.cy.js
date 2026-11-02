import { stubAuth } from '../support/stubs'

const DENVER = 'US-CO-031'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const monthDay = (offset) => new Date(`${day(offset)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const place = (trips = [], targets = ['clanut']) => ({ id: 7, name: 'Chiricahuas', state: 'AZ', location: 'US-AZ-003', range_mi: 30, home_lat: null, home_lng: null, targets, trips, seenCount: 0, lifers_scope: 'life' })

const open = (places) => {
  stubAuth({ loggedIn: true })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: 'US-AZ-003', name: 'Cochise' }, { code: DENVER, name: 'Denver' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [{ speciesCode: 'clanut', comName: "Clark's Nutcracker", sciName: '', birdImg: null }] })
  cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: places }).as('getPlaces')
  cy.visit('http://localhost:3000/settings?tab=places')
  cy.wait('@getPlaces')
}

describe('Big Day and scouting', () => {
  it('a Big Day is one date and scouts three weeks ahead by default, with the day scouting starts', () => {
    open([place()])
    cy.intercept('POST', '**/api/saved?kind=trip', (req) => req.reply({ statusCode: 201, body: { id: 9, ...req.body, active: false } })).as('postTrip')
    cy.contains('button', 'Add trip dates').click()
    cy.get('.place__trip-form input[name="bigday"]').check({ force: true })
    cy.get('.place__trip-form input[name="ends_on"]').should('not.exist')
    cy.get('.place__trip-form input[name="scout"]').should('be.checked')
    cy.contains('.place__scout-weeks button', '3 weeks').should('have.attr', 'aria-pressed', 'true')
    cy.get('.place__trip-form input[name="starts_on"]').type(day(40))
    cy.get('.place__scout-hint').should('have.text', `A daily report of where your target birds are being seen, starting ${monthDay(19)}.`)
    cy.contains('.place__trip-form button', 'Save dates').click()
    cy.wait('@postTrip').its('request.body').should('deep.equal', { place_id: 7, starts_on: day(40), ends_on: day(40), kind: 'bigday', scout: true, scout_days: 21 })
  })

  it('keeps a lead time already chosen when Big Day is switched on', () => {
    open([place()])
    cy.intercept('POST', '**/api/saved?kind=trip', (req) => req.reply({ statusCode: 201, body: { id: 9, ...req.body, active: false } })).as('postTrip')
    cy.contains('button', 'Add trip dates').click()
    cy.get('.place__trip-form input[name="scout"]').check({ force: true })
    cy.contains('.place__scout-weeks button', '1 week').click()
    cy.get('.place__trip-form input[name="bigday"]').check({ force: true })
    cy.contains('.place__scout-weeks button', '1 week').should('have.attr', 'aria-pressed', 'true')
    cy.get('.place__trip-form input[name="starts_on"]').type(day(40))
    cy.contains('.place__trip-form button', 'Save dates').click()
    cy.wait('@postTrip').its('request.body').should('include', { kind: 'bigday', scout: true, scout_days: 7 })
  })

  it('shows the trip line, a Scouting badge in the window, and asks for target birds when there are none', () => {
    const bigDay = { id: 9, starts_on: day(10), ends_on: day(10), active: false, kind: 'bigday', scout: true, scout_days: 21, scout_from: day(-11) }
    open([place([bigDay], [])])
    cy.get('.place__trips li').first().within(() => {
      cy.get('.place__trip-what').should('have.text', `${monthDay(10)} · Big Day · scouting from ${monthDay(-11)}`)
      cy.contains('.place__badge--scouting', 'Scouting')
    })
    cy.contains('.place__scout-note', 'Add target birds to get scouting reports.')
  })

  it('changes the lead time of an ordinary trip', () => {
    const trip = { id: 3, starts_on: day(30), ends_on: day(33), active: false, kind: 'trip', scout: true, scout_days: 21, scout_from: day(9) }
    open([place([trip])])
    cy.intercept('PATCH', '**/api/saved?kind=trip&id=3', (req) => req.reply({ statusCode: 200, body: { ...trip, ...req.body } })).as('patchTrip')
    cy.get('.place__trip-what').should('contain', `scouting from ${monthDay(9)}`).and('not.contain', 'Big Day')
    cy.get('.place__scout-badge, .place__badge--scouting').should('not.exist')
    cy.contains('.place__trips button', 'Change').click()
    cy.contains('.place__scout-weeks button', '1 week').click()
    cy.contains('.place__trip-form button', 'Save dates').click()
    cy.wait('@patchTrip').its('request.body').should('deep.equal', { starts_on: day(30), ends_on: day(33), kind: 'trip', scout: true, scout_days: 7 })
  })
})
