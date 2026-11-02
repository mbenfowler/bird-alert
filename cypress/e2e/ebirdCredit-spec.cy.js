import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

const credit = () => cy.get('.ebird-credit a').should('have.attr', 'href', 'https://ebird.org')

// eBird's API terms ask for credit wherever its data is shown: every page built from it carries the line.
describe('eBird credit', () => {
  it('shows under every page built from eBird sightings', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    credit()
    cy.contains('.ebird-credit', 'Sightings and checklists from eBird, the Cornell Lab of Ornithology')
    for (const path of ['/go', '/go?tab=best', '/map', '/life-list', '/saved']) {
      cy.visit(`http://localhost:3000${path}`)
      credit()
    }
  })

  it('is left off pages about the account alone', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings')
    cy.get('#settings-form')
    cy.get('.ebird-credit').should('not.exist')
    cy.contains('.settings-tabs button', 'Alerts').click()
    cy.contains('h2', 'Alert center')
    cy.get('.ebird-credit').should('not.exist')
  })

  it('credits eBird once on the public front page, in the page\'s own words', () => {
    stubAuth({ loggedIn: false })
    cy.visit('http://localhost:3000/')
    cy.contains('Sightings and hotspots come from').find('a[href="https://ebird.org"]').should('exist')
    cy.get('.ebird-credit').should('not.exist')
  })
})
