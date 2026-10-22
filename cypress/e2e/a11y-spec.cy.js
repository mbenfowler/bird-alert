import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

// Fails on serious and critical axe violations. Logs each violation so the CI output names the element.
const checkA11y = () => {
  // Let entrance animations finish; axe measures colours mid-fade otherwise.
  cy.get('body').then(($body) => {
    if ($body.find('.alerts-list > a').length) cy.get('.alerts-list > a').last().should('have.css', 'opacity', '1')
    if ($body.find('.alerts-list > .alerts-item').length) cy.get('.alerts-list > .alerts-item').last().should('have.css', 'opacity', '1')
  })
  cy.injectAxe()
  cy.checkA11y(undefined, { includedImpacts: ['critical', 'serious'] }, (violations) => {
    violations.forEach((v) => cy.task('log', `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`))
  })
}

describe('Accessibility', () => {
  it('login page', () => {
    stubAuth()
    cy.visit('http://localhost:3000/')
    cy.get('.input.email')
    checkA11y()
  })

  it('home with alerts and birds', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 }).should('have.length', 7)
    checkA11y()
  })

  it('home, arriving soon tab', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('#arriving').click()
    cy.get('.arrival-card').should('have.length', 2)
    checkA11y()
  })

  it('saved list', () => {
    login()
    cy.get('[href="/saved"] > .nav-img').click()
    // The saved page is lazy-loaded; the home page also has .birds-list .card, so wait for its own heading.
    cy.contains('.list-heading', 'Birds on your watch list', { timeout: 15000 })
    cy.get('.birds-list .card')
    checkA11y()
  })

  it('settings', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings')
    cy.get('#settings-form')
    checkA11y()
  })

  it('watch list sightings page', () => {
    login()
    cy.visit('http://localhost:3000/sightings?s=cangoo:S155544243,tuftit:S155544243')
    cy.get('.alert-sightings__table tbody tr').should('have.length', 2)
    checkA11y()
  })

  it('sighting page', () => {
    login()
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sightings-map .map-pin')
    cy.get('.season-strip__month').should('have.length', 12)
    checkA11y()
  })
})
