import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const LOCALES = [{ locale: 'en', name: 'English' }, { locale: 'es-MX', name: 'Español (México)' }, { locale: 'fr-CA', name: 'Français (Canada)' }]

describe('Language', () => {
  it('sets the language for bird names in Settings, and says the rest stays in English for now', () => {
    stubAuth({ loggedIn: true })
    cy.intercept('GET', '**/api/ebird/name-locales*', { statusCode: 200, body: LOCALES }).as('locales')
    cy.visit('http://localhost:3000/settings')
    cy.wait('@locales')
    cy.get('select[name="locale"]').should('have.value', '')
    cy.contains('Bird names switch now; the rest of the app is in English for now.')
    cy.get('select[name="locale"]').select('es-MX')
    cy.wait('@patchUser').its('request.body').should('deep.equal', { locale: 'es-MX' })
    cy.contains('Language saved!')
  })

  it('asks for bird names in the chosen language, in the address so each language caches apart', () => {
    stubAuth({ loggedIn: true, user: { ...TEST_USER, locale: 'es-MX' } })
    cy.intercept('GET', '**/api/ebird/observations*').as('observations')
    cy.intercept('GET', '**/api/saved').as('saved')
    cy.visit('http://localhost:3000/')
    cy.wait('@observations').its('request.url').should('include', 'locale=es-MX')
    // The person's own lists carry it as a header instead (the server uses their saved choice too).
    cy.wait('@saved').its('request.headers').should('have.property', 'x-locale', 'es-MX')
    cy.get('html').should('have.attr', 'lang', 'es-MX')
  })

  it('switches the page to another catalog once one exists, without reloading', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings')
    cy.contains('#settingsText', 'Settings')
    cy.contains('h2', 'Your details')
    // A made-up catalog stands in for the Spanish and French ones still to come.
    cy.window().then((win) => {
      win.__addCatalog('xx', { nav: { settings: 'Réglages' }, account: { title: 'Vos coordonnées' } })
      return win.__applyLocale('xx')
    })
    cy.contains('#settingsText', 'Réglages')
    cy.contains('h2', 'Vos coordonnées')
    // Words the catalog lacks fall back to English rather than showing a key.
    cy.contains('h2', 'Your life list')
  })
})
