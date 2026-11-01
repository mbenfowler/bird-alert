import { stubAuth } from '../support/stubs'

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
    cy.get('.landing__pickers select').first().find('optgroup[label="South Africa"] option').should('have.length', 9)
    cy.get('.landing__pickers select').first().select('Western Cape')
    cy.wait('@westernCape')
    cy.wait('@notableWeek').its('request.url').should('include', 'region=ZA-WC&')
    cy.get('.landing__pickers label').eq(1).should('contain', 'Municipality')
    cy.get('.landing__pickers select').eq(1).select('City of Cape Town')
    cy.wait('@notableWeek').its('request.url').should('include', 'region=ZA-WC-21')
  })

  it('in Settings a South African picks a province, then a municipality, and saves both', () => {
    stubAuth({ loggedIn: true })
    cy.intercept('GET', '**/api/ebird/regions?state=ZA-WC', { body: municipalities }).as('westernCape')
    cy.visit('http://localhost:3000/settings')
    cy.get('select[name="state"]').select('Western Cape')
    cy.wait('@westernCape')
    cy.contains('.field__label', 'Municipality')
    cy.get('select[name="location"]').select('ZA-WC-24')
    cy.get('#settings-form button[type="submit"]').click()
    cy.wait('@patchUser').its('request.body').should('deep.include', { state: 'ZA-WC', location: 'ZA-WC-24' })
  })
})
