import { stubAuth } from '../support/stubs'

describe('Creating an account', () => {
  beforeEach(() => {
    stubAuth({ userExists: false })
    cy.visit('http://localhost:3000/')
  })

  it('asks for a password once the email is unknown, enforces the minimum length, then lands on the set-location prompt', () => {
    cy.url().should('include', '/login')
    cy.get('.input.email').type('newbirder@example.com{enter}')
    cy.wait('@userExists')
    cy.contains('Email not found!')
    cy.contains('create password')

    cy.get('.input.password').type('short{enter}')
    cy.contains('Password must be at least 8 characters')
    cy.get('@signup.all').should('have.length', 0)

    cy.get('.input.password').clear()
    cy.get('.input.password').type('longenough1{enter}')
    cy.wait('@signup').its('request.body').should('deep.equal', { email: 'newbirder@example.com', password: 'longenough1' })
    cy.url().should('eq', 'http://localhost:3000/')
    cy.contains('Go to settings and set a location')
  })
})
