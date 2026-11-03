import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

// "Skip birds already on my life list": one setting, under the notable push, that also shapes the
// Uncommon sightings email. It waits for a life list of 10, as lifer alerts do.
const lifeList = (n) => Array.from({ length: n }, (_, i) => ({ speciesCode: `bird${i}`, firstSeen: '2020-01-01', source: 'import', comName: `Bird ${i}`, taxonOrder: i }))

const openAlerts = (birds, user = TEST_USER) => {
  stubAuth({ loggedIn: true, user })
  cy.intercept('GET', '**/api/saved?kind=seen*', { statusCode: 200, body: birds }).as('getSeen')
  cy.visit('http://localhost:3000/settings?tab=alerts')
  cy.get('.alert-center h2').should('exist')
  cy.wait('@getSeen')
  // The life list has reached the page once the Lifer chances hint stops asking for one.
  if (birds.length >= 10) cy.contains('.notification__hint', 'Needs 10 or more birds').should('not.exist')
}

describe('Skip birds already on my life list', () => {
  it('sits under Notable sightings, indented, and saves with a PATCH', () => {
    openAlerts(lifeList(12))
    // Directly under the Notable sightings toggle, before the timing choices.
    cy.get('#push_notable_enabled').closest('.notification').next().should('have.class', 'notification--nested').within(() => {
      cy.contains('label', 'Skip birds already on my life list')
      cy.contains('.notification__hint', 'Starred birds still come through. Applies to the Uncommon sightings email too.')
    })
    cy.get('.notification--nested').next().should('have.class', 'timing')
    // It shapes the email too, so it works with push off.
    cy.get('#push_enabled').should('not.be.checked')
    cy.get('[data-testid="skip-seen-email-note"]').should('not.exist')
    cy.get('#notable_skip_seen').should('not.be.checked').and('not.be.disabled').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: true })
    cy.get('#notable_skip_seen').should('be.checked')
    cy.contains('Alert preferences updated!')
    // The email gets a one-line note instead of a second switch.
    cy.get('[data-testid="skip-seen-email-note"]').should('have.text', 'Skips life-list birds')
      .closest('.notification').find('#rare_sightings_email_enabled').should('exist')
    cy.get('#notable_skip_seen').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: false })
    cy.get('[data-testid="skip-seen-email-note"]').should('not.exist')
  })

  it('waits for a life list, and points to it', () => {
    openAlerts(lifeList(3))
    cy.get('#notable_skip_seen').should('be.disabled').and('not.be.checked')
    cy.get('.notification--nested .notification__hint a').should('have.text', 'Import your life list first').and('have.attr', 'href', '/life-list')
    cy.contains('.notification--nested', 'Starred birds still come through').should('not.exist')
  })

  it('can still be switched off when it is on and the life list has emptied', () => {
    openAlerts([], { ...TEST_USER, notable_skip_seen: true })
    cy.get('#notable_skip_seen').should('be.checked').and('not.be.disabled')
    cy.get('[data-testid="skip-seen-email-note"]').should('exist')
  })

  it('fits a 375px phone without sideways scroll', () => {
    cy.viewport(375, 812)
    openAlerts(lifeList(12), { ...TEST_USER, notable_skip_seen: true })
    cy.get('#notable_skip_seen').should('be.visible')
    cy.contains('.notification__hint', 'Needs 10 or more birds').should('not.exist')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(375))
  })

  it('in Spanish and French too', () => {
    openAlerts(lifeList(12), { ...TEST_USER, locale: 'es-MX', notable_skip_seen: true })
    cy.contains('label[for="notable_skip_seen"]', 'Omitir aves que ya están en mi lista de vida')
    cy.get('[data-testid="skip-seen-email-note"]').should('have.text', 'Omite las aves de tu lista de vida')
    openAlerts(lifeList(12), { ...TEST_USER, locale: 'fr-CA', notable_skip_seen: true })
    cy.contains('label[for="notable_skip_seen"]', 'Ignorer les oiseaux déjà sur ma liste à vie')
    cy.get('[data-testid="skip-seen-email-note"]').should('have.text', 'Ignore les oiseaux de ta liste à vie')
  })

  // Only for the PR screenshot: CYPRESS_SHOT=1.
  it('screenshot at phone width', () => {
    if (!Cypress.env('SHOT')) return
    cy.viewport(390, 844)
    openAlerts(lifeList(12), { ...TEST_USER, notable_skip_seen: true })
    cy.get('#push_notable_enabled').closest('.notification').scrollIntoView({ offset: { top: -140, left: 0 } })
    cy.get('#notable_skip_seen').should('be.visible')
    cy.contains('.notification__hint', 'Needs 10 or more birds').should('not.exist')
    cy.screenshot('skip-seen-alert-center', { capture: 'viewport', overwrite: true })
  })
})
