import { login } from '../support/login'

describe('Polish: motion', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('a shown route draws itself from the start, its stops appearing in order along it', () => {
    cy.get('.alerts-go-link').click()
    cy.wait('@whereToGo')
    cy.contains('button', 'Show route on map').click()
    cy.get('.sightings-map.has-route').should('have.attr', 'data-drawn').and('match', /^route:/)
    // Each stop's pop waits for the line to reach it: later stops later.
    cy.get('.sightings-map .map-stop').then(($stops) => {
      const delays = [...$stops].map((el) => parseInt(el.style.animationDelay, 10))
      expect(delays.length).to.eq(2)
      expect(delays[1]).to.be.greaterThan(delays[0])
    })
    cy.get('.sightings-map .map-route').should('have.length', 2)
  })

  it('moving to another page fades it in, without reloading it', () => {
    cy.get('.route-view').should('not.have.attr', 'data-last-transition')
    cy.visit('http://localhost:3000/')
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('#settingsText').click({ force: true })
    cy.url().should('include', '/settings')
    cy.get('.route-view').should('have.attr', 'data-last-transition', '/settings')
    cy.contains('h2', 'Alert center')
  })
})
