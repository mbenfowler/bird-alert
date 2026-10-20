import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

// A page wider than the viewport is what lets phones zoom out and scroll sideways. None may be.
const assertNoHorizontalOverflow = () => {
  cy.document().its('documentElement').then((html) => {
    expect(html.scrollWidth, 'document width').to.be.at.most(html.clientWidth)
  })
}

describe('Phone-width layout', () => {
  beforeEach(() => cy.viewport(390, 844))

  it('login does not overflow', () => {
    stubAuth()
    cy.visit('http://localhost:3000/')
    cy.get('.input.email')
    assertNoHorizontalOverflow()
  })

  it('home, saved and settings do not overflow and the watch toggle is reachable', () => {
    login()
    cy.get('.birds-list .card').should('have.length', 7)
    assertNoHorizontalOverflow()
    cy.get('#rosgoo').should('be.visible')
    cy.get('[href="/saved"] > .nav-img').click()
    cy.get('.birds-list .card')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/settings')
    cy.get('#settings-form')
    assertNoHorizontalOverflow()
  })
})
