import { login } from '../support/login'

describe('Search', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 }).should('have.length', 7)
  })

  it('searches every bird by default and can narrow to the region', () => {
    cy.get('#birdSearch').type('goose')
    cy.wait('@search')
    cy.get('.birds-list .card').should('have.length', 3)
    cy.contains('3 matches. 2 of them are in your area.')

    cy.get('#searchRegionOnly').click()
    cy.get('.birds-list .card').should('have.length', 2)
    cy.get('#emgoo1').should('not.exist')
    cy.contains('2 matches in Hall, 1 more elsewhere.')

    cy.get('#birdSearch').clear()
    cy.get('#birdSearch').type('emperor')
    cy.contains('No birds in Hall match "emperor". 1 match elsewhere')
    cy.get('.list-note__link').click()
    cy.get('#searchRegionOnly').should('not.be.checked')
    cy.get('.birds-list .card').should('have.length', 1)
  })

  it('remembers the region-only choice on this device', () => {
    cy.get('#searchRegionOnly').click()
    cy.reload()
    cy.get('#searchRegionOnly', { timeout: 15000 }).should('be.checked')
  })
})
