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
    cy.contains('.list-heading', 'Birds on your watch list', { timeout: 15000 })
    cy.get('.birds-list .card')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/settings')
    cy.get('#settings-form')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sighting__title h1')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/map')
    cy.get('.sightings-map')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/sightings?s=cangoo:S155544243,tuftit:S155544243')
    cy.get('.alert-sightings__table')
    assertNoHorizontalOverflow()
  })

  it('shows every alerts tab title in full', () => {
    login()
    cy.get('.birds-list .card')
    for (const [tab, title] of [['star', 'Watch list sightings'], ['notable', 'Notable sightings'], ['arriving', 'Arriving soon']]) {
      cy.get(`#${tab}`).click()
      cy.get('.alerts-title').should('have.text', title).then(($el) => {
        expect($el[0].scrollWidth, `${title} fits`).to.be.at.most($el[0].clientWidth)
      })
    }
    assertNoHorizontalOverflow()
  })
})
