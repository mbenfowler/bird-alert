import { login, TEST_USER } from '../support/login'

describe('Confirm-your-email nudge', () => {
  it('tells an unconfirmed account where the link went, resends it, and steps aside for the visit', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('.confirm-nudge').should('not.exist')

    cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { ...TEST_USER, email_confirmed: false } })
    cy.intercept('POST', '**/api/auth/resend-confirmation', { statusCode: 200, body: { ok: true } }).as('resend')
    cy.visit('http://localhost:3000/')
    cy.get('.confirm-nudge').should('contain', 'Confirm your email to get alerts by email').and('contain', TEST_USER.email).and('contain', 'Spam and Promotions')
    cy.get('.confirm-nudge').contains('button', 'Resend').click()
    cy.wait('@resend')
    cy.contains('Sent. Look for “Confirm your email for Bird Alert”')
    cy.get('.confirm-nudge').contains('a', 'Wrong address?').should('have.attr', 'href', '/settings')

    cy.visit('http://localhost:3000/settings')
    cy.get('.confirm-nudge').should('not.exist')
    cy.visit('http://localhost:3000/go')
    cy.get('.confirm-nudge').contains('button', 'Later').click()
    cy.get('.confirm-nudge').should('not.exist')
    cy.visit('http://localhost:3000/')
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('.confirm-nudge').should('not.exist')
  })
})

describe('Session check', () => {
  it('says whether this is the installed app or a browser tab', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('@me.all').then((calls) => {
      const modes = calls.map((c) => c.request.headers['x-app-mode'])
      expect(modes).to.include('browser')
    })
  })
})
