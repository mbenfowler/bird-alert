import { login } from '../support/login'

describe('Migration season', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('lists species due back about now, with a watch toggle and the county radar link', () => {
    cy.get('#arriving').click()
    cy.wait('@arriving')
    cy.get('.alerts-title').should('contain', 'Arriving soon')
    cy.get('.alerts-count').should('contain', '2')
    cy.get('.arrival-card').should('have.length', 2)
    cy.get('.arrival-card').first()
      .should('contain', 'Tundra Swan')
      .and('contain', 'Reported 9 of 15 days this time last year')
      .and('contain', 'Back from Oct 12 last year')
    cy.get('.arrival-card').last().find('img').should('have.attr', 'src', '/images/noBirdImg.png')
    cy.get('.alerts-note a').should('have.attr', 'href', 'https://dashboard.birdcast.info/region/US-GA-139').and('contain', 'Hall')

    cy.get('#arriving-tunswa').should('not.be.checked')
    cy.get('#arriving-tunswa').click()
    cy.wait('@postSaved').its('request.body.speciesCode').should('eq', 'tunswa')
    cy.get('#arriving-tunswa').should('be.checked')
    cy.contains('Bird saved to watch list!')
  })

  it('keeps the other tabs as they were', () => {
    cy.get('#arriving').click()
    cy.get('#star').click()
    cy.get('.alerts-title').should('contain', 'Watch list sightings')
    cy.get('.arrival-card').should('not.exist')
    cy.get('.alerts-list > a').should('have.length.at.least', 1)
  })

  it('shows which months a species is around on the sighting page', () => {
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.wait('@seasonality')
    cy.contains('h2', 'When Canada Goose is around')
    cy.get('.season-strip__month').should('have.length', 12)
    cy.get('.season-strip__month.is-unknown').should('have.length', 2)
    cy.get('.season-strip__month.is-now').should('have.length', 1)
    cy.get('.season-strip__month').first().should('have.attr', 'title', 'Jan: reported on 28 of 31 days')
    cy.get('.season-strip figcaption').should('contain', '10 months on file so far')
  })
})
