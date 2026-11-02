import { stubAuth } from '../support/stubs'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const event = (over = {}) => ({
  id: 5, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30,
  starts_on: day(6), ends_on: day(6), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(-15), active: false,
  role: 'organizer',
  members: [{ display_name: 'Matt', role: 'organizer', you: true }],
  targets: [{ code: 'eletro' }, { code: 'mexchi' }, { code: 'whepar' }],
  tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456',
  ...over
})

const report = (over = {}) => ({
  code: 'eletro', comName: 'Elegant Trogon', locName: 'Cave Creek Canyon', locId: 'L123', lat: 31.88, lng: -109.17,
  obsDt: `${day(-1)} 07:30`, birders: 3, confirmed: true, media: true, subId: 'S100',
  ...over
})

const open = (ev, scouting) => {
  stubAuth({ loggedIn: true })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [
    { speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: null },
    { speciesCode: 'mexchi', comName: 'Mexican Chickadee', sciName: 'Poecile sclateri', birdImg: null },
    { speciesCode: 'whepar', comName: 'Whiskered Screech-Owl', sciName: 'Megascops trichopsis', birdImg: null }
  ] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [ev] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: scouting }).as('scouting')
  cy.visit('http://localhost:3000/events/5')
}

describe('Event scouting', () => {
  it('shows where the targets were reported lately, with evidence and links, and which are still unreported', () => {
    open(event(), {
      checked_at: new Date().toISOString(), days_to_go: 6, window: { from: day(-7), to: day(0) }, using: 'targets',
      reported: [report(), report({ code: 'mexchi', comName: 'Mexican Chickadee', locName: 'Rustler Park', obsDt: `${day(-3)} 09:00`, birders: 1, confirmed: null, media: false, subId: 'S200', lat: 31.9, lng: -109.27 })],
      unreported: [{ code: 'whepar', comName: 'Whiskered Screech-Owl' }]
    })
    cy.wait('@scouting').its('request.url').should('include', 'id=5')
    cy.get('[data-testid="event-scouting"]').within(() => {
      cy.get('.place__heading').should('contain', 'Scouting · 6 days to go · checked')
      cy.get('.event-scouting__fallback').should('not.exist')
      cy.contains('Reported lately (last 7 days)')
      cy.get('.event-scouting__item').should('have.length', 2)
      cy.get('.event-scouting__item').first().within(() => {
        cy.contains('a', 'Elegant Trogon').should('have.attr', 'href', '/sighting/eletro/S100')
        cy.get('.event-scouting__what').should('contain', 'Cave Creek Canyon').and('contain', 'yesterday')
        cy.contains('a', 'Checklist on eBird').should('have.attr', 'href', 'https://ebird.org/checklist/S100').and('have.attr', 'target', '_blank')
      })
      cy.get('.event-scouting__item').first().should('contain', 'Confirmed')
      // An ordinary report eBird never flagged has no confirmed/unconfirmed label.
      cy.get('.event-scouting__item').eq(1).should('contain', 'Rustler Park').and('contain', '3 days ago').and('not.contain', 'onfirmed')
      cy.get('.event-scouting__unreported').should('contain', 'Still unreported (nothing in 2 weeks):').and('contain', 'Whiskered Screech-Owl')
      cy.get('.event-scouting__map').should('exist')
    })
    // Between the target birds and the people.
    cy.get('[data-testid="event-scouting"]').prev().should('have.class', 'event-detail__targets')
    cy.get('[data-testid="event-scouting"]').next().should('have.class', 'event-detail__people')
  })

  it('with no targets, scouts the likely lifers and says so; nothing reported has its own line', () => {
    open(event({ targets: [] }), {
      checked_at: new Date().toISOString(), days_to_go: 6, window: { from: day(-7), to: day(0) }, using: 'likely_lifers',
      reported: [], unreported: []
    })
    cy.get('[data-testid="event-scouting"]').within(() => {
      cy.contains('.event-scouting__fallback', 'No targets yet, so these are likely lifers for your dates.')
      cy.contains('None of your likely lifers have been reported nearby in the last week.')
      cy.get('.event-scouting__item').should('not.exist')
      cy.get('.event-scouting__unreported').should('not.exist')
      cy.get('.event-scouting__map').should('not.exist')
    })
  })

  it('targets with no reports get the empty line', () => {
    open(event(), { checked_at: null, days_to_go: 6, using: 'targets', reported: [], unreported: [{ code: 'eletro', comName: 'Elegant Trogon' }] })
    cy.get('[data-testid="event-scouting"]').should('contain', 'None of your targets have been reported nearby in the last week.')
  })

  it('a past event has no scouting', () => {
    open(event({ past: true, starts_on: day(-20), ends_on: day(-20), recap: { species: 50, targets_got: 1, targets_total: 3 } }), { using: 'targets', reported: [], unreported: [] })
    cy.get('.event-detail__targets').should('exist')
    cy.get('[data-testid="event-scouting"]').should('not.exist')
  })
})
