import { stubAuth } from '../support/stubs'

describe('Links from emails work while logged out', () => {
  beforeEach(() => {
    stubAuth()
  })

  it('resets a password', () => {
    cy.visit('http://localhost:3000/reset/some-token')
    cy.url().should('include', '/reset/some-token')
    cy.get('#passwordOne').type('newpassword1')
    cy.get('#passwordTwo').type('newpassword2')
    cy.contains('Passwords do not match')
    cy.get('#confirmPasswordReset').should('be.disabled')

    cy.get('#passwordTwo').clear()
    cy.get('#passwordTwo').type('newpassword1')
    cy.get('#confirmPasswordReset').click()
    cy.wait('@reset').its('request.body').should('deep.equal', { token: 'some-token', password: 'newpassword1' })
    cy.url().should('include', '/login')
    cy.contains('Password has been reset!')
  })

  it('confirms an email address', () => {
    cy.visit('http://localhost:3000/confirm/confirm-token')
    cy.wait('@confirm').its('request.body').should('deep.equal', { token: 'confirm-token' })
    cy.contains('Email successfully confirmed!')
  })

  it('unsubscribes from a digest', () => {
    cy.intercept('POST', '**/api/auth/unsubscribe', { statusCode: 200, body: { ok: true, emailType: 'alert_digest_email_enabled' } }).as('unsubscribe')
    cy.visit('http://localhost:3000/unsubscribe/unsub-token')
    cy.wait('@unsubscribe').its('request.body').should('deep.equal', { token: 'unsub-token' })
    cy.contains('Successfully unsubscribed!')
  })
})
