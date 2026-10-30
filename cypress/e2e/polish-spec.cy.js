import { login } from '../support/login'

describe('Polish', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('a star going on the watch list bounces and throws sparks', () => {
    cy.get('#snogoo').click()
    cy.get('#snogoo').should('have.class', 'is-popping')
    cy.get('.pop-burst--sparks .pop-burst__piece').should('have.length', 6)
    // The sparks land and their layer clears itself away.
    cy.get('.pop-burst', { timeout: 4000 }).should('not.exist')
    cy.get('#snogoo').should('not.have.class', 'is-popping')
  })

  it('cards load behind skeletons shaped like them, which give way to the birds', () => {
    cy.intercept('GET', '**/api/birds?codes=*', (req) => {
      req.reply({ delay: 1500, statusCode: 200, body: [] })
    }).as('slowBirds')
    cy.clearLocalStorage()
    cy.visit('http://localhost:3000/')
    cy.get('.skeleton-list').should('have.attr', 'aria-busy', 'true').and('contain', 'Loading birds')
    cy.get('.skeleton-list .card.skeleton').first().within(() => {
      cy.get('.skeleton__img')
      cy.get('.skeleton__line').should('have.length', 3)
      cy.get('.skeleton__dot').should('have.length', 3)
    })
    cy.wait('@slowBirds')
    cy.get('.skeleton-list').should('not.exist')
  })

  it('a bird going on the life list is a lifer: feathers and a banner', () => {
    cy.get('#seen-snogoo').click()
    cy.get('.pop-burst--feathers .pop-burst__piece').should('have.length', 12)
    cy.contains('.lifer-toast', 'Lifer! Snow Goose').should('exist')
  })
})
