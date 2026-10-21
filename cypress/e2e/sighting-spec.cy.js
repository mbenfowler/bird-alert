import { login } from '../support/login'

describe('Sighting page and region map', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('opens a sighting from the alerts panel with photo, details, map and links out', () => {
    cy.get('.alerts-list > a').first().click()
    cy.url().should('include', '/sighting/cangoo/S155544243')
    cy.get('.sighting__title h1').should('contain', 'Canada Goose')
    cy.get('.sighting__photo').should('have.attr', 'src').and('include', 'unsplash')
    cy.get('.sighting__meta').should('contain', "Rusty's Gainesville Yard")
    cy.get('.sightings-map .map-pin').should('have.length.at.least', 1)
    cy.get('.sightings-map .map-pin--highlight').should('have.length', 1)
    cy.get('a.pill-button').contains('View on eBird').should('have.attr', 'href', 'https://ebird.org/checklist/S155544243')
    cy.get('a.pill-button').contains('Open in Maps').should('have.attr', 'target', '_blank')
    cy.get('button.pill-button').should('contain', 'On your watch list')
  })

  it('shows the region map with watch-list pins and switches to notable', () => {
    cy.get('.alerts-map-link').click()
    cy.url().should('include', '/map')
    cy.get('.map-page__bar h1').should('contain', 'Recent sightings in Hall')
    cy.get('.sightings-map .map-pin').should('have.length', 1)
    cy.contains('Birds on your watch list reported in your region')
    cy.get('.feed-tab').contains('Notable').click()
    cy.wait('@notable')
    cy.contains('Birds eBird flags as notable')
    cy.contains('No notable sightings reported in the last month.')
  })
})
