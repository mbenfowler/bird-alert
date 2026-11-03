import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

// "Skip birds already on my life list": one setting (notable_skip_seen) for rare-bird pushes and the
// Uncommon sightings email, so it has a switch in both places. It waits for a life list of 10, as lifer alerts do.
const lifeList = (n) => Array.from({ length: n }, (_, i) => ({ speciesCode: `bird${i}`, firstSeen: '2020-01-01', source: 'import', comName: `Bird ${i}`, taxonOrder: i }))
const PUSH = '#notable_skip_seen'
const EMAIL = '#notable_skip_seen_email'

/** The browser's push, faked: 'on' (allowed, subscribed) or 'unsupported' (no Push API). */
const fakePush = (mode) => {
  cy.on('window:before:load', (win) => {
    if (mode === 'unsupported') {
      delete win.PushManager
      return
    }
    const sub = { endpoint: 'https://push.example/abc', toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: async () => true }
    const registration = { pushManager: { getSubscription: async () => sub, subscribe: async () => sub }, update: async () => undefined }
    function Notification () {}
    Notification.permission = 'granted'
    Notification.requestPermission = async () => 'granted'
    Object.defineProperty(win, 'Notification', { value: Notification, configurable: true, writable: true })
    if (!win.PushManager) win.PushManager = function PushManager () {}
    Object.defineProperty(win.navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration), getRegistration: async () => registration, register: async () => registration, addEventListener: () => {}, removeEventListener: () => {}, controller: null }
    })
  })
}

const openAlerts = (birds, user = TEST_USER, push) => {
  stubAuth({ loggedIn: true, user })
  cy.intercept('GET', '**/api/saved?kind=seen*', { statusCode: 200, body: birds }).as('getSeen')
  if (push) fakePush(push)
  if (push === 'on') {
    cy.intercept('GET', '**/api/push/status*', { statusCode: 200, body: { subscribed: true, devices: 1, lastRun: { at: new Date(Date.now() - 14 * 60000).toISOString(), notified: 2 } } })
    cy.intercept('POST', '**/api/push/subscribe', { statusCode: 201, body: { ok: true } })
  }
  cy.visit('http://localhost:3000/settings?tab=alerts')
  cy.get('.alert-center h2').should('exist')
  cy.wait('@getSeen')
  // The life list has reached the page once the Lifer chances hint stops asking for one.
  if (birds.length >= 10) cy.contains('.notification__hint', 'Needs 10 or more birds').should('not.exist')
}

describe('Skip birds already on my life list', () => {
  it('sits under Notable sightings and under the Uncommon sightings email, and the two switches move together', () => {
    openAlerts(lifeList(12))
    // Under push: directly under the Notable sightings toggle, before the timing choices.
    cy.get('#push_notable_enabled').closest('.notification').next().should('have.class', 'notification--nested').within(() => {
      cy.contains('label', 'Skip birds already on my life list')
      cy.contains('.notification__hint', 'Already seen it? You won’t get a rare-bird alert for it, unless it’s starred.')
    })
    cy.get('.notification-sub .notification--nested').next().should('have.class', 'timing')
    // Under the email: nested in its card, with a hint that points back to the push.
    cy.get('#rare_sightings_email_enabled').closest('.notification').find('.notification--nested').within(() => {
      cy.contains('label', 'Skip birds already on my life list')
      cy.contains('.notification__hint', 'Already seen it? You won’t get a rare-bird alert for it, unless it’s starred.')
    })

    cy.get(PUSH).should('not.be.checked').and('not.be.disabled')
    cy.get(EMAIL).should('not.be.checked').and('not.be.disabled')
    cy.get(EMAIL).click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: true })
    cy.get(EMAIL).should('be.checked')
    cy.get(PUSH).should('be.checked')
    cy.contains('Alert preferences updated!')
    cy.get(PUSH).click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: false })
    cy.get(PUSH).should('not.be.checked')
    cy.get(EMAIL).should('not.be.checked')
    // The old one-line note is gone: the switch says it.
    cy.contains('Skips life-list birds').should('not.exist')
  })

  it('is reachable from the email where this browser cannot get push', () => {
    openAlerts(lifeList(12), TEST_USER, 'unsupported')
    cy.get('.notification__hint').should('contain', 'This browser cannot receive push notifications.')
    // The email card is never inside the dimmed push group.
    cy.get(EMAIL).closest('.notification-sub').should('not.exist')
    cy.get(EMAIL).closest('.notification--has-nested').should('have.css', 'opacity', '1')
    cy.get(EMAIL).should('be.visible').and('not.be.disabled').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: true })
    cy.get(EMAIL).should('be.checked')
  })

  it('waits for a life list in both places, and points to it', () => {
    openAlerts(lifeList(3))
    ;[PUSH, EMAIL].forEach((id) => {
      cy.get(id).should('be.disabled').and('not.be.checked')
      cy.get(id).closest('.notification--nested').find('.notification__hint a').should('have.text', 'Import your life list first').and('have.attr', 'href', '/life-list')
    })
    cy.contains('.notification--nested', 'Already seen it?').should('not.exist')
  })

  it('can still be switched off when it is on and the life list has emptied', () => {
    openAlerts([], { ...TEST_USER, notable_skip_seen: true })
    cy.get(PUSH).should('be.checked').and('not.be.disabled')
    cy.get(EMAIL).should('be.checked').and('not.be.disabled')
  })

  it('fits a 375px phone without sideways scroll', () => {
    cy.viewport(375, 812)
    openAlerts(lifeList(12), { ...TEST_USER, notable_skip_seen: true })
    cy.get(PUSH).should('be.visible')
    cy.get(EMAIL).scrollIntoView()
    cy.get(EMAIL).should('be.visible')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(375))
  })

  it('in Spanish and French too', () => {
    openAlerts(lifeList(12), { ...TEST_USER, locale: 'es-MX', notable_skip_seen: true })
    cy.contains(`label[for="notable_skip_seen"]`, 'Omitir aves que ya están en mi lista de vida')
    cy.get(EMAIL).closest('.notification--nested').should('contain', '¿Ya la viste? No te llegará alerta de ave rara por ella, a menos que esté en tu lista de seguimiento.')
    openAlerts(lifeList(12), { ...TEST_USER, locale: 'fr-CA', notable_skip_seen: true })
    cy.contains(`label[for="notable_skip_seen_email"]`, 'Ignorer les oiseaux déjà sur ma liste à vie')
    cy.get(EMAIL).closest('.notification--nested').should('contain', 'Tu l’as déjà vu ? Tu ne recevras pas d’alerte d’oiseau rare pour lui, sauf s’il est dans ta liste de suivi.')
  })

  // Only for the PR and email screenshots: CYPRESS_SHOT=1. Push on for this device, notable on, the option on.
  it('screenshots at phone width', () => {
    if (!Cypress.env('SHOT')) return
    cy.viewport(390, 844)
    openAlerts(lifeList(12), { ...TEST_USER, push_notable_enabled: true, notable_skip_seen: true }, 'on')
    cy.get('#push_enabled').should('be.checked')
    cy.get('.notification-sub').should('have.attr', 'aria-disabled', 'false')
    cy.get('#push_notable_enabled').should('be.checked')
    cy.get('#push_notable_enabled').closest('.notification').scrollIntoView({ offset: { top: -140, left: 0 } })
    cy.get(PUSH).should('be.visible').and('be.checked')
    cy.screenshot('skip-seen-alert-center', { capture: 'viewport', overwrite: true })
    cy.get('#rare_sightings_email_enabled').closest('.notification').scrollIntoView({ offset: { top: -200, left: 0 } })
    cy.get(EMAIL).should('be.visible').and('be.checked')
    cy.screenshot('skip-seen-email', { capture: 'viewport', overwrite: true })
  })
})
