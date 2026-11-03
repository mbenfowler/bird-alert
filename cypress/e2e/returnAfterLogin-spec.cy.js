import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const event = {
  id: 2, name: 'Chiricahuas', state: 'AZ', location: 'US-AZ-003', range_mi: 30,
  starts_on: day(30), ends_on: day(30), kind: 'bigday', scout: false, active: false, role: 'organizer',
  members: [{ display_name: 'Matt', role: 'organizer', you: true }], targets: [], tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456'
}

const stubEvent = () => {
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: { using: 'targets', reported: [], unreported: [] } })
}

const stubInvite = () => cy.intercept('GET', '**/api/saved?kind=event-preview*', { statusCode: 200, body: { name: 'Chiricahuas', area: 'Cochise County, Arizona', starts_on: day(30), ends_on: day(30), kind: 'bigday', members: 3 } })

// This browser already said "Not now" to a passkey, so signing in goes straight on.
const noOffer = { onBeforeLoad: (win) => win.localStorage.setItem('bird-alert:passkey-offer-dismissed', '1') }

const logIn = () => {
  cy.get('.input.email').type('robin@example.com{enter}')
  cy.wait('@userExists')
  cy.get('.input.password').type('password123{enter}')
  cy.wait('@login')
}

describe('Back where you were going after logging in', () => {
  it('a logged-out visit to an event goes to login with ?next=, then back to the event', () => {
    stubAuth()
    stubEvent()
    cy.visit('http://localhost:3000/events/2', noOffer)
    cy.location('pathname').should('eq', '/login')
    cy.location('search').should('eq', '?next=%2Fevents%2F2')
    cy.window().then(win => expect(win.sessionStorage.getItem('bird-alert:next')).to.eq('/events/2'))
    logIn()
    cy.location('pathname').should('eq', '/events/2')
    cy.contains('h1', 'Chiricahuas')
    // Arrived: nothing left to come back to.
    cy.window().then(win => expect(win.sessionStorage.getItem('bird-alert:next')).to.eq(null))
  })

  it('keeps the query (a settings tab)', () => {
    stubAuth()
    cy.visit('http://localhost:3000/settings?tab=alerts', noOffer)
    cy.location('search').should('eq', '?next=%2Fsettings%3Ftab%3Dalerts')
    logIn()
    cy.location('pathname').should('eq', '/settings')
    cy.location('search').should('eq', '?tab=alerts')
  })

  it('keeps the hash (an email link to an event route)', () => {
    stubAuth()
    stubEvent()
    cy.visit('http://localhost:3000/events/2#route', noOffer)
    cy.location('search').should('eq', '?next=%2Fevents%2F2%23route')
    logIn()
    cy.location('pathname').should('eq', '/events/2')
    cy.location('hash').should('eq', '#route')
  })

  it('the passkey offer after logging in goes on to next too', () => {
    stubAuth({ user: { ...TEST_USER, hasPasskey: false } })
    stubEvent()
    cy.visit('http://localhost:3000/events/2')
    logIn()
    cy.contains('h1', 'next time?')
    cy.contains('button', 'Not now').click()
    cy.location('pathname').should('eq', '/events/2')
  })

  it('an invite: Log in or sign up comes back to the invite to join', () => {
    stubAuth()
    stubInvite()
    cy.visit('http://localhost:3000/events/join/inv123', noOffer)
    cy.get('a.nav-login').should('have.attr', 'href', '/login?next=%2Fevents%2Fjoin%2Finv123')
    cy.contains('.event-page a', 'Log in or sign up').should('have.attr', 'href', '/login?next=%2Fevents%2Fjoin%2Finv123').click()
    logIn()
    cy.location('pathname').should('eq', '/events/join/inv123')
    cy.get('.event-page__join input[name="display_name"]').should('exist')
  })

  it('a new account keeps next through signup and its setup, then lands there', () => {
    const state = stubAuth({ userExists: false, user: { ...TEST_USER, onboarded_at: null } })
    stubEvent()
    cy.intercept('PATCH', '**/api/user', (req) => {
      state.user = { ...state.user, ...req.body, ...(req.body.onboarded ? { onboarded_at: '2026-11-03T12:00:00Z' } : {}) }
      req.reply({ statusCode: 200, body: state.user })
    }).as('patch')
    cy.visit('http://localhost:3000/events/2', noOffer)
    cy.location('search').should('eq', '?next=%2Fevents%2F2')
    cy.get('.input.email').type('newbirder@example.com{enter}')
    cy.wait('@userExists')
    cy.get('.input.password').type('longenough1{enter}')
    cy.wait('@signup')
    // A new account goes through setup first; skipping it ends at the event.
    cy.location('pathname').should('eq', '/welcome')
    cy.contains('button', 'Skip').click()
    cy.wait('@patch').its('request.body').should('deep.equal', { onboarded: true })
    cy.location('pathname').should('eq', '/events/2')
    cy.contains('h1', 'Chiricahuas')
    cy.window().then(win => expect(win.sessionStorage.getItem('bird-alert:next')).to.eq(null))
  })

  for (const evil of ['//evil.com', 'https://evil.com', '/\\evil.com', '/login']) {
    it(`next=${evil} lands on home`, () => {
      stubAuth()
      cy.visit(`http://localhost:3000/login?next=${encodeURIComponent(evil)}`, noOffer)
      logIn()
      cy.location('href').should('eq', 'http://localhost:3000/')
    })
  }

  it('already logged in, /login?next= goes straight there', () => {
    stubAuth({ loggedIn: true })
    stubEvent()
    cy.visit('http://localhost:3000/login?next=%2Fevents%2F2')
    cy.location('pathname').should('eq', '/events/2')
    cy.contains('h1', 'Chiricahuas')
  })

  it('already logged in with an evil next goes home', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/login?next=%2F%2Fevil.com')
    cy.location('href').should('eq', 'http://localhost:3000/')
  })
})
