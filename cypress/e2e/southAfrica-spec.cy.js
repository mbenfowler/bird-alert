import { browseTo, stubAuth } from '../support/stubs'

// South Africa's provinces keep eBird's country prefix ('ZA-WC'): NL and NC already mean Newfoundland and North Carolina.
const municipalities = [{ code: 'ZA-WC-21', name: 'City of Cape Town' }, { code: 'ZA-WC-24', name: 'Stellenbosch' }]

describe('South Africa', () => {
  it('its provinces are in the picker, and a province\'s municipalities are offered by name', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/notable*', { fixture: 'notableWeek' }).as('notableWeek')
    cy.intercept('GET', '**/api/ebird/observations*', { fixture: 'notableWeek' })
    cy.intercept('GET', '**/api/ebird/regions?state=ZA-WC', { body: municipalities }).as('westernCape')
    cy.visit('http://localhost:3000/')
    cy.wait('@notableWeek')
    cy.contains('.landing__pickers button', 'Change place').click()
    browseTo('South Africa', 'Western Cape')
    cy.wait('@westernCape')
    cy.get('.area-picker select[name="location"]').select('City of Cape Town')
    cy.wait('@notableWeek').its('request.url').should('include', 'region=ZA-WC-21')
  })

  it('in Settings a South African picks a province, then a municipality, and saves both', () => {
    stubAuth({ loggedIn: true })
    cy.intercept('GET', '**/api/ebird/regions?state=ZA-WC', { body: municipalities }).as('westernCape')
    cy.visit('http://localhost:3000/settings')
    cy.contains('#settings-form button', 'Change').click()
    browseTo('South Africa', 'Western Cape', 'Stellenbosch')
    cy.get('[data-testid="current-area"]').should('have.text', 'Stellenbosch, Western Cape, South Africa')
    cy.get('#settings-form button[type="submit"]').click()
    cy.wait('@patchUser').its('request.body').should('deep.include', { state: 'ZA-WC', location: 'ZA-WC-24' })
  })
})
