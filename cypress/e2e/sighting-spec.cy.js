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
    cy.get('.sighting__tips').should('contain', 'Where to look').and('contain', 'V formations').and('contain', 'Any time')
  })

  it('choosing another report from the list swaps the selection without moving the page', () => {
    // Two reports at two places, so there is something to choose between. Later intercepts win.
    cy.fixture('recentBirds').then((obs) => {
      const first = obs.find((o) => o.subId === 'S155544243')
      const second = { ...first, subId: 'S155544999', locName: 'Lake Lanier Olympic Park', obsDt: '2023-11-28 09:10', lat: first.lat + 0.03, lng: first.lng - 0.02, howMany: 4 }
      cy.intercept('GET', '**/api/ebird/species-observations*', { statusCode: 200, body: [first, second] }).as('twoReports')
    })
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sighting__list li').should('have.length', 2)
    // Scrolling past the bird card docks the frame under the bar; only then does the list scroll by itself.
    cy.get('.sighting__frame').should('not.have.class', 'is-docked')
    cy.scrollTo('bottom')
    cy.get('.sighting__frame').should('have.class', 'is-docked')
    cy.window().then((win) => {
      const docked = win.scrollY
      cy.get('.sighting__list li').eq(1).find('button').invoke('text').then((label) => {
        cy.get('.sighting__list li').eq(1).find('button').click({ scrollBehavior: false })
        cy.get('.sighting__list li.is-current button').should('have.text', label)
        cy.get('.sighting__meta strong').invoke('text').then((place) => {
          expect(label).to.include(place)
          cy.get('.leaflet-popup').should('contain', place)
        })
      })
      cy.url().should('include', '/sighting/cangoo/S155544999')
      cy.window().its('scrollY').should('eq', docked)
    })
    cy.go('back')
    cy.url().should('not.include', '/sighting/')
  })

  it('shows the region map with watch-list pins and switches to notable', () => {
    cy.get('.alerts-map-link').click()
    cy.url().should('include', '/map')
    cy.get('.map-page__bar h1').should('contain', 'Watch list sightings in Hall')
    cy.get('.sightings-map .map-pin').should('have.length', 1)
    cy.get('.map-page__tabs button[aria-label="Notable sightings"]').click()
    cy.wait('@notable')
    cy.get('.map-page__bar h1').should('contain', 'Notable sightings in Hall')
    cy.contains('No notable sightings reported in the last month.')
  })
})
