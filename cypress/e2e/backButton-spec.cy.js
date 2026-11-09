import { login } from '../support/login'

describe('Back button', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('from a notable sighting, Back returns to the list with the Notable tab still open', () => {
    cy.fixture('recentBirds').then((obs) => {
      cy.intercept('GET', '**/api/ebird/notable*', { statusCode: 200, body: obs.slice(0, 3) }).as('notableSome')
    })
    cy.get('#notable').click()
    cy.get('#notable').should('have.attr', 'aria-pressed', 'true')
    cy.get('.alerts-list .alert-link').first().click()
    cy.location('pathname').should('match', /^\/sighting\//)
    cy.contains('a.back-button', 'Back').should('have.attr', 'href', '/').click()
    cy.location('pathname').should('eq', '/')
    cy.get('#notable').should('have.attr', 'aria-pressed', 'true')
    cy.get('.alerts-title').should('contain', 'Notable')
    // History went back: forward returns to the sighting.
    cy.go('forward')
    cy.location('pathname').should('match', /^\/sighting\//)
  })

  it('Back keeps the page scrolled where it was left', () => {
    cy.scrollTo(0, 120)
    cy.window().its('scrollY').should('be.closeTo', 120, 2)
    cy.get('.alerts-list .alert-link').first().click({ scrollBehavior: false })
    cy.location('pathname').should('match', /^\/sighting\//)
    cy.window().its('scrollY').should('eq', 0)
    cy.get('a.back-button').click()
    cy.location('pathname').should('eq', '/')
    cy.window().its('scrollY').should('be.closeTo', 120, 4)
  })

  it('Back keeps a search that was typed', () => {
    cy.get('#birdSearch').type('goose')
    cy.get('.alerts-list .alert-link').first().click()
    cy.location('pathname').should('match', /^\/sighting\//)
    cy.get('a.back-button').click()
    cy.get('#birdSearch').should('have.value', 'goose')
  })

  it('a sighting opened straight from a link goes back to home', () => {
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sighting__title h1').should('contain', 'Canada Goose')
    cy.get('a.back-button').should('have.attr', 'href', '/').and('have.css', 'min-height', '44px').click()
    cy.location('pathname').should('eq', '/')
    cy.get('.birds-list .card').should('exist')
  })

  it('the alert sightings page and Where to go have it too', () => {
    cy.get('.alerts-go-link').click()
    cy.location('pathname').should('eq', '/go')
    cy.get('a.back-button').click()
    cy.location('pathname').should('eq', '/')
    cy.visit('http://localhost:3000/sightings?s=cangoo:S155544243')
    cy.get('a.back-button').should('contain', 'Back')
  })
})
