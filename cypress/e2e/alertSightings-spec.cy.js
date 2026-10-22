import { login } from '../support/login'

// The page a watch-list push notification opens: the announced sightings on one map plus a table.
describe('Watch list sightings page', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('maps and lists every sighting named in the link', () => {
    cy.visit('http://localhost:3000/sightings?s=cangoo:S155544243,tuftit:S155544243')
    cy.get('.alert-sightings h1').should('contain', 'Watch list sightings')
    cy.contains('.list-note', '2 birds from your watch list reported in Hall')
    cy.get('.sightings-map .map-pin').should('have.length', 2)
    cy.get('.alert-sightings__table tbody tr').should('have.length', 2)
    cy.get('.alert-sightings__table tbody tr').first()
      .should('contain', 'Canada Goose')
      .and('contain', "Rusty's Gainesville Yard")
    cy.get('.alert-sightings__table tbody tr').first().find('a').click()
    cy.url().should('include', '/sighting/cangoo/S155544243')
  })

  it('explains a link that names nothing', () => {
    cy.visit('http://localhost:3000/sightings')
    cy.contains('.list-note', 'did not name any sightings')
    cy.get('.sightings-map').should('not.exist')
  })
})
