import { login } from "../support/login"

describe("Login flow for a user that already has location set", () => {
  beforeEach(() => {
    login()
  })

  it("should be able to login with correct email and password", () => {
      cy.get('#titleBird').should('contain', 'Bird')
      .get('#titleAlert').should('contain', 'Alert')
      .get('[href="/saved"]').should('be.visible')
      .get(':nth-child(2) > .nav-img').should('be.visible')
      .get('.alerts-header').should('contain', 'Watch list sightings')
      .get('.alerts-count').should('contain', '1')
      .get('.alerts-list .alert-link > .card').should('be.visible')
        .and('contain', 'Canada Goose')
        .and('contain', 'Dec 1, 1:49 PM')
        .and('contain', "Rusty's Gainesville Yard")
      .get('.alerts-toggle').should('have.attr', 'aria-expanded', 'true')
      .get('#birdSearch').invoke('attr', 'placeholder').should('contain', 'Search birds by name')
      .get('#birdsInArea > h2').should('contain', 'Birds in your area')
      .get('.list-heading__region').should('contain', 'Hall - US-GA-139')
      .get('#snogoo').should('be.checked')
      .get('.birds-list .card').should('have.length', 7)
      .get('.list-end').should('contain', "That's all 7 birds")
  })
})

describe("Alerts panel", () => {
  beforeEach(() => {
    login()
  })

  it("collapses to its bar and expands again, and switches to notable sightings", () => {
    cy.get('.alerts-list').should('be.visible')
    cy.get('.alerts-toggle').click()
    cy.get('.alerts-toggle').should('have.attr', 'aria-expanded', 'false')
    cy.get('.alerts-list').should('not.be.visible')
    cy.get('.alerts-toggle').click()
    cy.get('.alerts-list').should('be.visible')

    cy.get('#notable').click()
    cy.wait('@notable')
    cy.get('.alerts-header').should('contain', 'Notable sightings')
    cy.get('.alerts-empty').should('contain', 'No notable sightings')
  })
})
