import { login } from '../support/login'

// Three notable reports of the same bird: confirmed with a photo and three birders, one awaiting
// review, and one from a server that doesn't send evidence yet.
const withEvidence = (obs) => [
  { ...obs[0], subId: 'S1', evidence: { confirmed: true, media: true, birders: 3 } },
  { ...obs[0], subId: 'S2', locName: 'Second Place', evidence: { confirmed: false, media: false, birders: 1 } },
  { ...obs[0], subId: 'S3', locName: 'Third Place' }
]

describe('The evidence behind a rare-bird report', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('an alert card says whether it is confirmed, has a photo and how many birders, and says nothing when the server doesn\'t', () => {
    cy.fixture('recentBirds').then((obs) => {
      cy.intercept('GET', '**/api/ebird/notable*', { body: withEvidence(obs) }).as('notable')
    })
    cy.get('#notable').click()
    cy.wait('@notable')
    const card = (n) => cy.get('.alerts-list .alert-card').eq(n)
    card(0).find('.evidence').should('contain', '✓ Confirmed').and('contain', 'Photo or audio').and('contain', '3 birders')
    card(1).find('.evidence').should('contain', 'Unconfirmed').and('not.contain', 'birder').and('not.contain', 'Photo')
    card(2).find('.evidence').should('not.exist')
  })

  it('the sighting page spells it out under the place', () => {
    cy.fixture('recentBirds').then((obs) => {
      const rows = withEvidence(obs.filter((o) => o.speciesCode === 'cangoo'))
      cy.intercept('GET', '**/api/ebird/species-observations*', { body: rows }).as('rows')
    })
    cy.visit('http://localhost:3000/sighting/cangoo/S1')
    cy.wait('@rows')
    cy.get('.sighting__pick .evidence').within(() => {
      cy.contains('li', '✓ Confirmed by an eBird reviewer')
      cy.contains('li', 'Photo or audio on the checklist')
      cy.contains('li', 'Reported by 3 birders')
    })
    cy.visit('http://localhost:3000/sighting/cangoo/S2')
    cy.wait('@rows')
    cy.get('.sighting__pick .evidence').should('contain', 'Unconfirmed: not yet reviewed by eBird').find('li').should('have.length', 1)
    cy.visit('http://localhost:3000/sighting/cangoo/S3')
    cy.wait('@rows')
    cy.get('.sighting__pick .sighting__meta').should('contain', 'Third Place')
    cy.get('.sighting__pick .evidence').should('not.exist')
  })
})
