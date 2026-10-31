import { login } from '../support/login'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1'
const KEY = 'bird-alert:push-ask'
const DAY = 86_400_000

/**
 * The browser's notifications and push, faked for every page load in the test: permission as given
 * (granting it when asked), and a subscription only once one is made, unless `subscribed`.
 */
const fakePush = ({ permission = 'default', subscribed = false, iphone = false, record = null } = {}) => {
  cy.on('window:before:load', (win) => {
    const makeSub = () => ({ endpoint: 'https://push.example/abc', toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: async () => true })
    let sub = subscribed ? makeSub() : null
    const registration = { pushManager: { getSubscription: async () => sub, subscribe: async () => (sub = makeSub()) }, update: async () => undefined }
    function Notification () {}
    Notification.permission = permission
    Notification.requestPermission = async () => { Notification.permission = 'granted'; return 'granted' }
    Object.defineProperty(win, 'Notification', { value: Notification, configurable: true, writable: true })
    if (!win.PushManager) win.PushManager = function PushManager () {}
    Object.defineProperty(win.navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration), getRegistration: async () => registration, register: async () => registration, addEventListener: () => {}, removeEventListener: () => {}, controller: null }
    })
    if (iphone) Object.defineProperty(win.navigator, 'userAgent', { value: IPHONE })
    if (record) win.localStorage.setItem(KEY, JSON.stringify(record))
  })
  cy.intercept('GET', '**/api/push/public-key', { statusCode: 200, body: { publicKey: 'BFakeKeyForTests' } })
  cy.intercept('POST', '**/api/push/subscribe', { statusCode: 201, body: { ok: true } }).as('subscribe')
}

describe('Push ask', () => {
  it('after saving a bird, a device without alerts is asked once, and Turn on alerts turns them on', () => {
    fakePush()
    login()
    cy.get('#rosgoo').click()
    cy.wait('@postSaved')
    cy.get('.push-ask').should('be.visible').and('have.attr', 'role', 'dialog')
    cy.get('#push-ask-question').should('have.text', 'Want a ping the moment a Ross\'s Goose is reported near you?')
    // It stands in for the "saved" toast rather than stacking with it.
    cy.contains('Bird saved to watch list!').should('not.exist')
    cy.contains('.push-ask button', 'Turn on alerts').click()
    cy.wait('@subscribe').its('request.body.endpoint').should('eq', 'https://push.example/abc')
    cy.get('.push-ask').should('not.exist')
    cy.contains('Alerts are on. You’ll hear about Ross\'s Goose here.')
  })

  it('on an iPhone Safari tab, the same question comes with the Home Screen steps, not a button', () => {
    fakePush({ iphone: true })
    login()
    cy.get('#rosgoo').click()
    cy.get('.push-ask .install-steps__list li').should('have.length', 3)
    cy.contains('.push-ask button', 'Turn on alerts').should('not.exist')
    // Escape is "Not now".
    cy.get('body').type('{esc}')
    cy.get('.push-ask').should('not.exist')
    cy.window().then((win) => expect(JSON.parse(win.localStorage.getItem(KEY)).dismissals).to.eq(1))
  })

  it('never asks a device that already gets alerts', () => {
    fakePush({ permission: 'granted', subscribed: true })
    login()
    cy.get('#rosgoo').click()
    cy.contains('Bird saved to watch list!')
    cy.get('.push-ask').should('not.exist')
  })

  it('never asks where notifications are blocked', () => {
    fakePush({ permission: 'denied' })
    login()
    cy.get('#rosgoo').click()
    cy.contains('Bird saved to watch list!')
    cy.get('.push-ask').should('not.exist')
  })

  it('after Not now it doesn’t ask again this visit, and remembers when it was said', () => {
    fakePush()
    login()
    cy.get('#rosgoo').click()
    cy.contains('.push-ask button', 'Not now').click()
    cy.get('.push-ask').should('not.exist')
    // Not again this visit.
    cy.get('#swagoo1').click()
    cy.contains('Bird saved to watch list!')
    cy.get('.push-ask').should('not.exist')
    cy.window().then((win) => {
      const record = JSON.parse(win.localStorage.getItem(KEY))
      expect(record.dismissals).to.eq(1)
      expect(Date.now() - record.last).to.be.lessThan(60_000)
    })
  })

  it('a week after Not now it may ask again', () => {
    fakePush({ record: { dismissals: 1, last: Date.now() - 8 * DAY } })
    login()
    cy.get('#rosgoo').click()
    cy.get('.push-ask').should('be.visible')
  })

  it('within the week after Not now it stays quiet', () => {
    fakePush({ record: { dismissals: 1, last: Date.now() - 2 * DAY } })
    login()
    cy.get('#rosgoo').click()
    cy.contains('Bird saved to watch list!')
    cy.get('.push-ask').should('not.exist')
  })

  it('after three Not nows it never asks again', () => {
    fakePush({ record: { dismissals: 3, last: Date.now() - 400 * DAY } })
    login()
    cy.get('#rosgoo').click()
    cy.contains('Bird saved to watch list!')
    cy.get('.push-ask').should('not.exist')
  })
})
