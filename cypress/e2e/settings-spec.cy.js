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
    cy.get('#settings-form button[type="submit"]').click()

    cy.wait('@patchUser').its('request.body').should('deep.include', { state: 'CA', location: 'US-GA-121' })
    cy.url().should('eq', 'http://localhost:3000/')
    cy.contains('Settings saved!')
  })

  it('warns that a changed email needs confirming again', () => {
    cy.get('input[name="email"]').clear()
    cy.get('input[name="email"]').type('newaddress@example.com')
    cy.get('#settings-form button[type="submit"]').click()
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

  it('shows when the hourly check last ran and the quiet-hours window', () => {
    cy.get('[data-testid="last-checked"]').should('contain', 'Last checked 14 min ago').and('contain', 'nothing new')
    cy.get('#push_quiet_enabled').should('be.checked').and('be.disabled')
    cy.contains('No pushes between 10 PM and 6 AM')
  })

  it('sends an email digest now on request and says when there is nothing to send', () => {
    cy.intercept('POST', '**/api/mailPreview', (req) => {
      req.reply({ statusCode: 200, body: req.body.kind === 'migration' ? { sent: true, items: 7 } : { sent: false, reason: 'nothing' } })
    }).as('mailPreview')
    cy.get('button[data-preview="migration"]').click()
    cy.wait('@mailPreview').its('request.body').should('deep.equal', { kind: 'migration' })
    cy.contains('Sent to robin@example.com')
    cy.get('button[data-preview="rare"]').click()
    cy.wait('@mailPreview')
    cy.contains('Nothing to send right now: no notable sightings nearby in the last day.')
  })

  it('offers first-of-season pushes and the weekly migration email', () => {
    cy.get('#push_first_of_season').should('be.disabled').and('not.be.checked')
    cy.contains('The first report of a migrant returning to your area')
    cy.get('#migration_email_enabled').should('not.be.checked')
    cy.get('#migration_email_enabled').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { migration_email_enabled: true })
    cy.get('#migration_email_enabled').should('be.checked')
  })

  it('sends an idea or a problem straight to the owner, and says thanks', () => {
    cy.intercept('POST', '**/api/saved?kind=feedback', { statusCode: 201, body: { ok: true } }).as('feedback')
    cy.get('.feedback__send').should('be.disabled')
    cy.contains('.feedback__kind', 'Something’s broken').click()
    cy.contains('.feedback__kind', 'Something’s broken').should('have.attr', 'aria-checked', 'true')
    cy.get('.feedback__text').should('have.attr', 'placeholder').and('include', 'What happened')
    cy.get('.feedback__text').type('The map pins overlap on my phone.')
    cy.get('.feedback__send').click()
    cy.wait('@feedback').its('request.body').should('deep.equal', { kind: 'bug', message: 'The map pins overlap on my phone.', page: '/settings' })
    cy.contains('.feedback__thanks', 'Thanks! I read every one.')
    cy.get('.feedback__text').should('have.value', '')
    // Too many in a day: the server says so, in its own words.
    cy.intercept('POST', '**/api/saved?kind=feedback', { statusCode: 429, body: { error: 'Thanks for all the ideas! Send more tomorrow.' } })
    cy.get('.feedback__text').type('One more idea')
    cy.get('.feedback__send').click()
    cy.contains('.feedback__error', 'Send more tomorrow')
  })
})
