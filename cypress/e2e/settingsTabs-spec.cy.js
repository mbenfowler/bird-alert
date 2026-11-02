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

    tab('Alerts').click()
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
    tab('Alerts').should('have.attr', 'aria-pressed', 'true')
    cy.visit('http://localhost:3000/settings#alert-center')
    tab('Alerts').should('have.attr', 'aria-pressed', 'true')
    // "Extend my trip" and "Save this place" are about places.
    cy.visit('http://localhost:3000/settings#places?trip=3')
    tab('Places').should('have.attr', 'aria-pressed', 'true')
    cy.visit('http://localhost:3000/settings?trip=3')
    tab('Places').should('have.attr', 'aria-pressed', 'true')
    cy.visit('http://localhost:3000/settings?addPlace=US-CO-031')
    tab('Places').should('have.attr', 'aria-pressed', 'true')
    cy.get('.place-form')
    // Anything else is the account.
    cy.visit('http://localhost:3000/settings?tab=nonsense')
    tab('Account').should('have.attr', 'aria-pressed', 'true')
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
