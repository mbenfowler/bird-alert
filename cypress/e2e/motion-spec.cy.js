import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

describe('Motion', () => {
  it('alert cards slide in from the right on load, and again when another tab is picked', () => {
    login()
    cy.get('.alerts-list > a', { timeout: 15000 }).first()
      .should(($a) => expect(getComputedStyle($a[0]).animationName).to.eq('alert-in'))
    cy.get('#notable').click()
    cy.get('.alerts-list > a').first()
      .should(($a) => expect(getComputedStyle($a[0]).animationName).to.eq('alert-in'))
    cy.get('#star').click()
    cy.get('.alerts-list > a').first()
      .should(($a) => expect(getComputedStyle($a[0]).animationName).to.eq('alert-in'))
  })

  it('opening Delete my account sounds the red alert: the siren glow, and the klaxon unless sound is off', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings', {
      // Sound off for the test run: the glow still comes, and nothing tries to play.
      onBeforeLoad: (win) => win.localStorage.setItem('alertMode', JSON.stringify({ sound: false }))
    })
    cy.contains('button', 'Delete my account').click()
    cy.get('html').should('have.attr', 'data-alarm', 'siren')
    cy.contains('h2', 'Delete your account?')
  })
})
