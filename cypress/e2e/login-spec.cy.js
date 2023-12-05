import { login } from "../support/login"

describe("Login flow for a user that already has location set", () => {
  beforeEach(() => {
    login()
  })

  it("should be able to login with correct email and password", () => {
      cy.get('#titleBird').should('contain', 'Bird')
      .get('#titleAlert').should('contain', 'Alert')
      .get('[href="/saved"] > .nav-img').should('be.visible')
      .get(':nth-child(2) > .nav-img').should('be.visible')
      .get('.alerts-header').should('contain', 'Alerts:')
      .get('#birdAlerts > a > .card').should('be.visible')
        .and('contain', 'Canada Goose')
        .and('contain', '2023-12-01 13:49')
        .and('contain', "Rusty's Gainesville Yard")
        .then(() => {
          cy.get('#birdAlerts').children().should('have.length', 2)
        })
      .get('#birdSearch').invoke('attr', 'placeholder').should('contain', 'Search birds by name')
      .get('#birdsInArea > h2').should('contain', 'Birds in your area')
      .get('#snogoo').should('be.checked')
      .get('.pagination > p').should('contain', 'Page 1 of 2')
      .get('.pagination-btn').should('contain', '>')
  })
})
