import { login } from '../support/login'

describe('Alert! mode', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('an alert arriving while the app is on screen shows its toast and sounds the alarm, sized to the bird', () => {
    // A push the server sent just now, after the app opened: the next poll offers it.
    cy.intercept('GET', '**/api/push/pending', { body: { push: { title: '❗ ABA Code 4: Roadside Hawk reported nearby', url: 'http://localhost:3000/sighting/roahaw/S1?region=US-GA-139', sentAt: new Date().toISOString(), tappedAt: null, offeredAt: null, openedAt: null } } }).as('pending')
    cy.contains('.Toastify__toast', 'Roadside Hawk', { timeout: 15000 })
    cy.get('html').should('have.attr', 'data-alarm', 'siren')
    cy.get('.alarm-glow').should('have.css', 'opacity').and('not.eq', '0')
    // It settles on its own.
    cy.get('html', { timeout: 12000 }).should('not.have.attr', 'data-alarm')
  })

  it('stays dark when this device turned the lights off', () => {
    cy.window().then((win) => win.localStorage.setItem('alertMode', JSON.stringify({ lights: false, sound: false })))
    cy.intercept('GET', '**/api/push/pending', { body: { push: { title: '❗ Notable: Black Scoter reported nearby', url: 'http://localhost:3000/sighting/blksco2/S2', sentAt: new Date().toISOString(), tappedAt: null, offeredAt: null, openedAt: null } } })
    cy.contains('.Toastify__toast', 'Black Scoter', { timeout: 15000 })
    cy.get('html').should('not.have.attr', 'data-alarm')
  })

  it('has its switches in Alert Center, on by default, greyed out until push is on here', () => {
    cy.visit('http://localhost:3000/settings')
    cy.contains('.notification__label', 'Alert! mode')
    cy.get('.alert-mode .switch').should('have.length', 2).each(($i) => { expect($i).to.be.checked; expect($i).to.be.disabled })
    // A sound per kind of alert, with the defaults chosen, and quiet to start.
    cy.get('#alert-sound-watchlist').should('have.value', 'chime').and('be.disabled')
    cy.get('#alert-sound-notable').should('have.value', 'bridge-chirp')
    cy.get('#alert-sound-lifer').should('have.value', 'say-binoculars')
    cy.get('#alert-sound-mega').should('have.value', 'red-alert-say')
    cy.get('#alert-sound-mega optgroup').then(($g) => expect([...$g].map((g) => g.label)).to.deep.equal(['Classic', 'Sci-fi', 'Bird calls', 'Spoken', 'Off']))
    cy.get('.alert-mode__volume .is-selected').should('have.text', 'Quiet')
    cy.contains('.alert-mode button', 'Try the full alarm').should('be.disabled')
  })
})
