import { stubAuth } from '../support/stubs'

describe('Creating an account', () => {
  beforeEach(() => {
    stubAuth({ userExists: false })
    cy.visit('http://localhost:3000/login')
  })

  it('asks for a password once the email is unknown, enforces the minimum length, then lands on the set-location prompt', () => {
    cy.url().should('include', '/login')
    cy.get('.input.email').type('newbirder@example.com{enter}')
    cy.wait('@userExists')
    cy.contains('h1', 'Create your account')
    cy.contains('label', 'Create a password')

    cy.get('.input.password').type('short{enter}')
    cy.contains('Passwords need at least 8 characters')
    cy.get('@signup.all').should('have.length', 0)

    cy.get('.input.password').clear()
    cy.get('.input.password').type('longenough1{enter}')
    cy.wait('@signup').its('request.body').should((body) => {
      expect(body).to.deep.include({ email: 'newbirder@example.com', password: 'longenough1' })
      // What brought them in rides along: here, straight to the sign-in page.
      expect(body.source).to.deep.equal({ landing: 'login' })
    })
    // A device that can use passkeys is offered one, once; "Not now" goes on and is remembered.
    cy.contains('h1', 'next time?')
    cy.contains('button', 'Not now').click()
    cy.url().should('eq', 'http://localhost:3000/')
    cy.contains('Go to settings and set a location')
  })

  it('brings the county from the splash page, so a new account lands on its birds', () => {
    cy.visit('http://localhost:3000/login', { onBeforeLoad: (win) => win.localStorage.setItem('bird-alert:landing-region', 'US-GA-139') })
    cy.get('.input.email').type('newbirder@example.com')
    cy.contains('button', 'Continue').click()
    cy.wait('@userExists')
    cy.get('.login-county').should('contain', 'Your county: Hall County, Georgia')
    cy.get('.login-eye').should('have.text', 'Show').click()
    cy.get('.input.password').should('have.attr', 'type', 'text').type('longenough1')
    cy.contains('button', 'Create account').click()
    cy.wait('@signup').its('request.body').should((body) => {
      expect(body).to.deep.include({ email: 'newbirder@example.com', password: 'longenough1', state: 'GA', location: 'US-GA-139' })
      expect(body.source).to.deep.equal({ landing: 'login' })
    })
  })
})
