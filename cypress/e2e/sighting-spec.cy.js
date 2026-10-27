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
    cy.get('.sighting__odds').should('contain', 'Here all year').and('contain', 'Best 8 am to 10 am')
    cy.get('.sighting__places li').should('have.length', 2)
    // The track record sits behind a badge; a tap opens it, a tap elsewhere closes it.
    cy.get('.accuracy__panel').should('not.be.visible')
    cy.contains('.accuracy__badge', 'Checked against real reports').click()
    cy.get('.accuracy__panel li').should('have.length', 2)
    cy.get('.accuracy__panel li').first().should('contain', '60% or better').and('contain', '71%')
    cy.get('.accuracy__panel li').last().should('contain', '20–39%').and('contain', '22%')
    cy.get('body').click(0, 0)
    cy.get('.accuracy__panel').should('not.be.visible')
    cy.get('.sighting__places li').first().should('have.class', 'is-current').and('contain', 'High').and('contain', 'private').and('contain', 'behind the barn')
    cy.get('.sighting__places li').first().find('.place__chance').should('have.text', 'You have an 86% chance to see it here, best 7 am to 9 am')
    cy.get('.sighting__places li').first().find('.place__evidence').should('have.text', '5 days in 30 · last yesterday 1:49 PM · on 4 of 6 checklists')
    cy.get('.sighting__places li').eq(1).should('contain', 'Fair').and('contain', '+1 nearby')
    cy.get('.sighting__places li').eq(1).find('.place__chance').should('have.text', 'You have a 31% chance to see it here, best 8 am to 10 am')
    cy.get('.sighting__places li').eq(1).find('.place__evidence').should('have.text', '1 day in 30 · last 4 days ago 9:10 AM · 2 checklists lately')
  })

  it('choosing another report from the list swaps the selection without moving the page', () => {
    // Two reports at two places, so there is something to choose between. Later intercepts win.
    cy.fixture('recentBirds').then((obs) => {
      const first = obs.find((o) => o.subId === 'S155544243')
      const second = { ...first, subId: 'S155544999', locId: 'L999', locName: 'Lake Lanier Olympic Park', obsDt: '2023-11-28 09:10', lat: first.lat + 0.03, lng: first.lng - 0.02, howMany: 4 }
      cy.intercept('GET', '**/api/ebird/species-observations*', { statusCode: 200, body: [first, second] }).as('twoReports')
    })
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sighting__places li').should('have.length', 2)
    // Scrolling past the bird card docks the frame under the bar; only then does the list scroll by itself.
    cy.get('.sighting__frame').should('not.have.class', 'is-docked')
    cy.scrollTo('bottom')
    cy.get('.sighting__frame').should('have.class', 'is-docked')
    cy.window().then((win) => {
      const docked = win.scrollY
      cy.get('.sighting__places li').eq(1).find('button').click({ scrollBehavior: false })
      cy.get('.sighting__places li.is-current').should('contain', 'Lake Lanier Olympic Park')
      cy.get('.sighting__meta strong').should('have.text', 'Lake Lanier Olympic Park')
      cy.get('.leaflet-popup').should('contain', 'Lake Lanier Olympic Park')
      cy.url().should('include', '/sighting/cangoo/S155544999')
      cy.window().its('scrollY').should('eq', docked)
    })
    cy.go('back')
    cy.url().should('not.include', '/sighting/')
  })

  it('shows the region map with watch-list pins and switches to notable', () => {
    cy.get('.alerts-map-link[href="/map"]').click()
    cy.url().should('include', '/map')
    cy.get('.map-page__bar h1').should('contain', 'Watch list sightings in Hall')
    cy.get('.sightings-map .map-pin').should('have.length', 1)
    cy.get('.map-page__tabs button[aria-label="Notable sightings"]').click()
    cy.wait('@notable')
    cy.get('.map-page__bar h1').should('contain', 'Notable sightings in Hall')
    cy.contains('No notable sightings reported in the last month.')
  })

  it('a private place shows public land inside its card, laid out as designed', () => {
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sighting__places li').first().should('contain', 'private').within(() => {
      cy.get('.nearby__ask').should('be.visible').then(($b) => expect($b[0].getBoundingClientRect().height).to.be.lessThan(60))
      cy.get('.nearby__ask').click()
      cy.get('.nearby__head strong').should('contain', 'Public land near').then(($s) => expect($s[0].getBoundingClientRect().width, 'heading is not squeezed into a column').to.be.greaterThan(100))
      cy.get('.nearby__close').then(($b) => expect($b[0].getBoundingClientRect().height).to.be.lessThan(50))
      cy.get('.nearby__list li').should('have.length', 3)
      cy.get('.nearby__list li').first().should('have.css', 'border-top-width', '0px')
    })
    cy.get('.leaflet-popup').should('not.exist')
    cy.get('.sightings-map.is-focused').should('exist')
  })
})
