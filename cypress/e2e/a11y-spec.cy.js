import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

// Fails on serious and critical axe violations. Logs each violation so the CI output names the element.
const checkA11y = () => {
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
    cy.get('.birds-list .card', { timeout: 15000 }).should('have.length', 5)
    checkA11y()
  })

  it('saved list', () => {
    login()
    cy.get('[href="/saved"] > .nav-img').click()
    cy.get('.birds-list .card', { timeout: 15000 })
    checkA11y()
  })

  it('settings', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings')
    cy.get('#settings-form')
    checkA11y()
  })
})
