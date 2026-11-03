import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

// "Skip birds already on my life list": one switch (notable_skip_seen) for rare-bird pushes and the
// Uncommon sightings email, right after "Only once there's proof" in the alert range card, which
// shows whatever the push state. It waits for a life list of 10, as lifer alerts do.
const lifeList = (n) => Array.from({ length: n }, (_, i) => ({ speciesCode: `bird${i}`, firstSeen: '2020-01-01', source: 'import', comName: `Bird ${i}`, taxonOrder: i }))
const SWITCH = '#notable_skip_seen'
const HINT = 'Already seen it? You won’t get a rare‑bird alert for it, unless it’s starred.'

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
  it('is one switch, right after the proof setting, and saves with a PATCH', () => {
    openAlerts(lifeList(12))
    cy.get(SWITCH).should('have.length', 1)
    cy.get('[name="notable_skip_seen"]').should('have.length', 1)
    cy.get('#rare_alerts_need_proof').closest('.alert-range__proof').next().should('have.class', 'alert-range__skip-seen').within(() => {
      cy.contains('label', 'Skip birds already on my life list')
      cy.get('.notification__hint').should('have.text', HINT)
    })
    // Not inside the push group, so never dimmed with push off.
    cy.get('#push_enabled').should('not.be.checked')
    cy.get(SWITCH).closest('.notification-sub').should('not.exist')
    cy.get(SWITCH).should('not.be.checked').and('not.be.disabled').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: true })
    cy.get(SWITCH).should('be.checked')
    cy.contains('Alert preferences updated!')
    cy.get(SWITCH).click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: false })
    cy.get(SWITCH).should('not.be.checked')
  })

  it('shows where this browser cannot get push', () => {
    openAlerts(lifeList(12), TEST_USER, 'unsupported')
    cy.get('.notification__hint').should('contain', 'This browser cannot receive push notifications.')
    cy.get(SWITCH).should('be.visible').and('not.be.disabled').click()
    cy.wait('@patchUser').its('request.body').should('deep.equal', { notable_skip_seen: true })
  })

  it('waits for a life list, and points to it', () => {
    openAlerts(lifeList(3))
    cy.get(SWITCH).should('be.disabled').and('not.be.checked')
    cy.get('.alert-range__skip-seen .notification__hint a').should('have.text', 'Import your life list first').and('have.attr', 'href', '/life-list')
    cy.contains('.alert-range__skip-seen', 'Already seen it?').should('not.exist')
  })

  it('can still be switched off when it is on and the life list has emptied', () => {
    openAlerts([], { ...TEST_USER, notable_skip_seen: true })
    cy.get(SWITCH).should('be.checked').and('not.be.disabled')
  })

  it('fits a 375px phone without sideways scroll', () => {
    cy.viewport(375, 812)
    openAlerts(lifeList(12), { ...TEST_USER, notable_skip_seen: true })
    cy.get(SWITCH).scrollIntoView()
    cy.get(SWITCH).should('be.visible')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(375))
  })

  it('in Spanish and French too', () => {
    openAlerts(lifeList(12), { ...TEST_USER, locale: 'es-MX' })
    cy.contains('label[for="notable_skip_seen"]', 'Omitir aves que ya están en mi lista de vida')
    cy.get('.alert-range__skip-seen .notification__hint').should('have.text', '¿Ya la viste? No te llegará alerta de ave rara por ella, a menos que esté en tu lista de seguimiento.')
    openAlerts(lifeList(12), { ...TEST_USER, locale: 'fr-CA' })
    cy.contains('label[for="notable_skip_seen"]', 'Ignorer les oiseaux déjà sur ma liste à vie')
    cy.get('.alert-range__skip-seen .notification__hint').should('have.text', 'Tu l’as déjà vu ? Tu ne recevras pas d’alerte d’oiseau rare pour lui, sauf s’il est dans ta liste de suivi.')
  })

  // Only for the PR screenshot: CYPRESS_SHOT=1. Push on for this device, notable on, the switch on.
  it('screenshot at phone width', () => {
    if (!Cypress.env('SHOT')) return
    cy.viewport(390, 844)
    openAlerts(lifeList(12), { ...TEST_USER, push_notable_enabled: true, notable_skip_seen: true }, 'on')
    cy.get('#push_enabled').should('be.checked')
    cy.get('#push_notable_enabled').should('be.checked')
    cy.get('#rare_alerts_need_proof').closest('.alert-range__proof').scrollIntoView({ offset: { top: -220, left: 0 } })
    cy.get(SWITCH).should('be.visible').and('be.checked')
    cy.screenshot('skip-seen-alert-center', { capture: 'viewport', overwrite: true })
  })
})
