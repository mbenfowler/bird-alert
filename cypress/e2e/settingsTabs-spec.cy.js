import { stubAuth } from '../support/stubs'

const tab = (name) => cy.contains('.settings-tabs button', name)

describe('Settings tabs', () => {
  beforeEach(() => {
    stubAuth({ loggedIn: true })
    cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [] }).as('getPlaces')
  })

  it('opens on Account, switches tabs in the address, and keeps feedback on every tab', () => {
    cy.visit('http://localhost:3000/settings')
    tab('Account').should('have.attr', 'aria-pressed', 'true')
    cy.get('#settings-form')
    cy.get('.alert-center').should('not.exist')
    cy.get('.feedback')
    cy.contains('button', 'Log out')

    tab('Alert Center').click()
    cy.url().should('include', 'tab=alerts')
    cy.contains('h2', 'Alert center')
    cy.get('#settings-form').should('not.exist')
    cy.get('.feedback')
    cy.contains('button', 'Log out').should('not.exist')

    tab('Places').click()
    cy.url().should('include', 'tab=places')
    cy.get('#places')
    cy.get('.feedback')

    tab('Account').click()
    cy.url().should('not.include', 'tab=')
    cy.get('#settings-form')
  })

  it('lands links on the right tab', () => {
    cy.visit('http://localhost:3000/settings?tab=alerts')
    tab('Alert Center').should('have.attr', 'aria-pressed', 'true')
    cy.visit('http://localhost:3000/settings#alert-center')
    tab('Alert Center').should('have.attr', 'aria-pressed', 'true')
    // "Save this place" is about places, and so is #places.
    cy.visit('http://localhost:3000/settings#places')
    tab('Places').should('have.attr', 'aria-pressed', 'true')
    cy.visit('http://localhost:3000/settings?addPlace=US-CO-031')
    tab('Places').should('have.attr', 'aria-pressed', 'true')
    cy.get('.place-form')
    // Anything else is the account.
    cy.visit('http://localhost:3000/settings?tab=nonsense')
    tab('Account').should('have.attr', 'aria-pressed', 'true')
  })

  describe('old trip links', () => {
    // Trips became events, and nothing records which trip became which event: every old trip link
    // lands on the events list, which says where trips went.
    const event = { id: 7, name: 'Patagonia', state: 'AZ', location: 'US-AZ-023', range_mi: 30, starts_on: '2099-05-01', ends_on: '2099-05-03', kind: 'trip', scout: false, active: false, role: 'organizer', members: [{ display_name: null, role: 'organizer', you: true }], targets: [], tally: [] }
    beforeEach(() => {
      cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event] }).as('events')
      cy.intercept('GET', '**/api/saved?kind=trip*', { statusCode: 410, body: { error: 'Trips are events now' } }).as('trip')
    })
    const lands = () => {
      cy.location('pathname').should('eq', '/events')
      cy.location('search').should('eq', '')
      cy.get('[data-testid="trips-moved"]').should('have.text', 'Trips are now Events. Find yours here.')
      cy.get('[data-testid="events-upcoming"] > li').should('have.length', 1).and('contain', 'Patagonia')
      cy.get('.settings-tabs').should('not.exist')
      cy.get('@trip.all').should('have.length', 0)
    }
    const links = {
      'the trip email’s Extend my trip (/settings#places?trip=)': '/settings#places?trip=3',
      'Settings with ?trip=': '/settings?trip=3',
      'the Places tab with &trip=': '/settings?tab=places&trip=3',
      'a ?trip= with #places after it': '/settings?trip=3#places'
    }
    Object.entries(links).forEach(([name, path]) => {
      it(`${name} lands on the events list with a note`, () => {
        cy.visit(`http://localhost:3000${path}`)
        lands()
      })
    })

    it('the note is only for old trip links, and a plain Places link still opens Settings', () => {
      cy.visit('http://localhost:3000/events')
      cy.wait('@events')
      cy.get('[data-testid="events-upcoming"] > li').should('have.length', 1)
      cy.get('[data-testid="trips-moved"]').should('not.exist')
      cy.visit('http://localhost:3000/settings?tab=places')
      tab('Places').should('have.attr', 'aria-pressed', 'true')
      cy.location('pathname').should('eq', '/settings')
    })

    it('logged out: sign in first, then the events list with the note', () => {
      stubAuth()
      cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event] })
      cy.visit('http://localhost:3000/settings#places?trip=3', { onBeforeLoad: (win) => win.localStorage.setItem('bird-alert:passkey-offer-dismissed', '1') })
      cy.location('pathname').should('eq', '/login')
      cy.get('.input.email').type('robin@example.com{enter}')
      cy.wait('@userExists')
      cy.get('.input.password').type('password123{enter}')
      cy.wait('@login')
      lands()
    })
  })

  it('home is one setting: changed in Places, it shows in Account, and the other way round', () => {
    cy.visit('http://localhost:3000/settings?tab=places')
    cy.get('[data-testid="places-home"]').should('have.text', 'Hall County')
    cy.contains('.place--home button', 'Change').click()
    cy.contains('.place--home button', 'Browse by country').click()
    cy.get('.place--home select[name="location"]').select('Fulton')
    cy.wait('@patchUser').its('request.body').should('deep.equal', { state: 'GA', location: 'US-GA-121' })
    cy.contains('Home saved!')
    cy.get('[data-testid="places-home"]').should('have.text', 'Fulton County')

    tab('Account').click()
    cy.get('[data-testid="current-area"]').should('contain', 'Fulton County')

    // Changed in Account (saved with the details), Places shows it.
    cy.contains('#settings-form button', 'Change').click()
    cy.contains('#settings-form button', 'Browse by country').click()
    cy.get('#settings-form select[name="location"]').select('Hall')
    cy.get('#settings-form button[type="submit"]').click()
    cy.wait('@patchUser').its('request.body').should('deep.include', { state: 'GA', location: 'US-GA-139' })
    cy.visit('http://localhost:3000/settings?tab=places')
    cy.get('[data-testid="places-home"]').should('have.text', 'Hall County')
  })
})
