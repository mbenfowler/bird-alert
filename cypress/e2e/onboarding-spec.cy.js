import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const NEW_USER = { ...TEST_USER, onboarded_at: null, hasPasskey: true }
const bird = (speciesCode, comName) => ({ speciesCode, comName, sciName: comName, birdImg: '/images/bird.png' })

describe('Setup after signing up', () => {
  beforeEach(() => {
    stubAuth({ loggedIn: true, user: NEW_USER })
    cy.intercept('GET', '**/api/ebird/notable*', { fixture: 'notableWeek' })
    cy.intercept('GET', '**/api/ebird/arriving*', { body: { learning: false, arrivals: [{ speciesCode: 'whtspa', comName: 'White-throated Sparrow', sciName: 'Zonotrichia albicollis', daysLastYear: 9, windowDays: 14 }] } })
    cy.intercept('GET', '**/api/ebird/observations*', { body: [{ speciesCode: 'norcar', comName: 'Northern Cardinal', locId: 'L1', locName: 'Chicopee Lake', obsDt: '2026-10-27 08:00', lat: 34.2, lng: -83.8, subId: 'S1' }] })
    cy.intercept('GET', '**/api/birds?*', { body: [bird('paibun', 'Painted Bunting'), bird('sedwre', 'Sedge Wren'), bird('whtspa', 'White-throated Sparrow'), bird('norcar', 'Northern Cardinal')] })
    cy.intercept('POST', '**/api/saved', (req) => req.reply({ statusCode: 201, body: bird(req.body.speciesCode, req.body.speciesCode) })).as('star')
    cy.intercept('PATCH', '**/api/user', (req) => req.reply({ statusCode: 200, body: { ...NEW_USER, ...req.body, onboarded_at: req.body.onboarded ? '2026-10-28T12:00:00Z' : null } })).as('patch')
  })

  it('starts with the birds, then alerts, then the life list (No ends it), and lands on Where to go', () => {
    cy.visit('http://localhost:3000/')
    cy.url().should('include', '/welcome')
    cy.contains('h1', 'Tap the birds you’d love to see')
    // Notable birds first, then arriving migrants, then recent reports, each with its photo.
    cy.get('.onboard__tile').should('have.length', 4).first().should('contain', 'Painted Bunting').and('contain', 'Notable this week')
    cy.contains('.onboard__tile', 'White-throated Sparrow').should('contain', 'Arriving now')
    cy.contains('.onboard__tile', 'Painted Bunting').click()
    cy.contains('.onboard__tile', 'Northern Cardinal').click()
    cy.contains('.onboard__tile', 'Northern Cardinal').should('have.attr', 'aria-pressed', 'true')
    cy.contains('button', 'Next (2)').click()
    cy.wait('@star'); cy.wait('@star')
    cy.contains('h1', 'How should we tell you?')
    cy.contains('.onboard__rows label', 'Rarities near you').find('input').click()
    cy.contains('button', 'Next').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { push_watchlist_enabled: true, push_first_of_season: true, push_notable_enabled: true, alert_digest_email_enabled: false })
    cy.contains('h1', 'Do you keep an eBird life list?')
    cy.contains('button', 'No').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { onboarded: true })
    cy.url().should('include', '/go')
  })

  it('a life list goes in last, and the lifer alert is offered once it has birds', () => {
    cy.intercept('POST', '**/api/saved?kind=seen&import=1', { body: { added: 284, already: 0, total: 284, skipped: [] } }).as('import')
    cy.visit('http://localhost:3000/welcome')
    cy.contains('button', 'Next').click()
    cy.contains('button', 'Next').click()
    cy.wait('@patch')
    cy.contains('button', 'Yes').click()
    cy.get('input[type=file]').selectFile({ contents: Cypress.Buffer.from('Common Name,Scientific Name\nSnow Goose,Anser caerulescens\n'), fileName: 'life.csv', mimeType: 'text/csv' }, { force: true })
    cy.wait('@import')
    cy.contains('.onboard__ok', '284 birds on your life list')
    cy.contains('.onboard__lifer button', 'Turn on').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { push_lifer_enabled: true })
    cy.contains('.onboard__ok', 'possible lifer is nearby')
    cy.contains('button', 'Done').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { onboarded: true })
    cy.url().should('eq', 'http://localhost:3000/', 'nothing starred: home, not Where to go')
  })

  it('Skip is always there and ends setup for good', () => {
    cy.visit('http://localhost:3000/welcome')
    cy.contains('.onboard__skip', 'Skip').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { onboarded: true })
    cy.url().should('eq', 'http://localhost:3000/')
  })
})
