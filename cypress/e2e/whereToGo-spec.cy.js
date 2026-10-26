import { login } from '../support/login'

describe('Where to go', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('reaches the page from the alerts bar and shows the route, places and bird chips', () => {
    cy.get('.alerts-go-link').click()
    cy.url().should('include', '/go')
    cy.wait('@whereToGo').its('request.url').should('match', /codes=cangoo(%2C|,)snogoo/)
    cy.get('.go__summary').should('contain', '2 birds on your watch list').and('contain', '2 places in Hall')
    cy.get('.go__stops li').should('have.length', 1).first().should('contain', 'Lake Lanier Olympic Park').and('contain', '0.8 birds expected')
    cy.get('.go__covers').should('contain', 'about 0.8 birds of your 2')
    cy.get('.go__route a.pill-button').should('have.attr', 'href').and('include', 'google.com/maps/dir')
    cy.get('.go__places li').should('have.length', 2)
    cy.get('.go__places li').first().should('contain', "Rusty's Gainesville Yard").and('contain', '0.9 birds').and('contain', 'private')
    cy.get('.go__places li').first().find('.go__bird').should('have.length', 1).and('contain', 'Canada Goose 86%')
    cy.get('.go__places li').eq(1).should('contain', 'today').find('.go__bird').should('have.length', 2)
  })

  it('tapping a place highlights its pin, and a bird chip opens the species page', () => {
    cy.visit('http://localhost:3000/go')
    cy.get('.go__places li').eq(1).find('.go__place-head').click()
    cy.get('.go__places li.is-current').should('contain', 'Lake Lanier Olympic Park')
    cy.get('.sightings-map .map-pin--highlight').should('have.length', 1)
    cy.get('.go__places li').eq(1).find('.go__bird').first().click()
    cy.url().should('include', '/sighting/tuftit/S155544243')
  })
})
