import { stubAuth } from '../support/stubs'

// A session cookie is simulated by having /api/auth/me answer with the user straight away.
describe('Settings', () => {
  beforeEach(() => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings')
  })

  it('saves a new state and region, then returns home', () => {
    cy.get('select[name="state"]').should('have.value', 'GA')

    cy.get('select[name="state"]').select('CA')
    cy.wait('@regions')
    cy.get('select[name="location"]').should('have.value', '')
    cy.get('select[name="location"]').select('US-GA-121')
    cy.get('button.submit').click()

    cy.wait('@patchUser').its('request.body').should('deep.include', { state: 'CA', location: 'US-GA-121' })
    cy.url().should('eq', 'http://localhost:3000/')
    cy.contains('Settings saved!')
  })

  it('warns that a changed email needs confirming again', () => {
    cy.get('input[name="email"]').clear()
    cy.get('input[name="email"]').type('newaddress@example.com')
    cy.get('button.submit').click()
    cy.wait('@patchUser').its('request.body.email').should('eq', 'newaddress@example.com')
    cy.contains('Email changed. Check your inbox for a new confirmation link.')
  })

  it('toggles an alert preference', () => {
    cy.get('#alert_digest_email_enabled').should('be.checked')
    cy.get('#alert_digest_email_enabled').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { alert_digest_email_enabled: false })
    cy.get('#alert_digest_email_enabled').should('not.be.checked')
    cy.contains('Alert preferences updated!')
  })

  it('keeps the push sub-options greyed out until push is on for this device', () => {
    cy.get('#push_enabled').should('not.be.checked')
    cy.get('.notification-sub').should('have.attr', 'aria-disabled', 'true')
    cy.get('#push_watchlist_enabled').should('be.disabled').and('be.checked')
    cy.get('#push_notable_enabled').should('be.disabled').and('not.be.checked')
  })

  it('offers right-away or batched timing only when notable pushes are on', () => {
    cy.get('.timing').should('be.disabled')
    cy.get('.timing__option.is-selected').should('contain', 'Right away')
  })
})
