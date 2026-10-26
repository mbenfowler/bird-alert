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
    cy.get('.go__stops li').should('have.length', 2).first().should('contain', 'Lake Lanier Olympic Park').and('contain', '0.8 birds expected').and('contain', 'Tufted Titmouse 52%')
    cy.get('.go__stops li').eq(1).find('.go__leg').should('have.text', '↓ 9 min drive · 3.1 mi')
    cy.get('.go__covers').should('contain', 'about 1.4 birds of your 2').and('contain', '9 minutes of driving, 3.1 miles').and('contain', 'Start at Lake Lanier Olympic Park, best 8 am to 10 am')
    cy.get('.go__route a.pill-button').should('have.attr', 'href').and('include', 'google.com/maps/dir')
    // The route can be drawn on the map: one road line and numbered stops.
    cy.get('.sightings-map.has-route').should('not.exist')
    cy.contains('button', 'Show route on map').click()
    cy.get('.sightings-map.has-route .map-route').should('have.length', 2)
    cy.get('.sightings-map .map-stop').should('have.length', 2)
    cy.contains('button', 'Hide route on map').click()
    cy.get('.sightings-map.has-route').should('not.exist')
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

  it('a private place opens its public lands: the map focuses, draws the roads, and a tap outside closes it', () => {
    cy.visit('http://localhost:3000/go')
    cy.get('.go__places li').first().should('contain', 'private').find('.nearby__ask').should('contain', 'Public land nearby').click()
    cy.wait('@nearby').its('request.url').should('match', /lat=34\.26954&lng=-83\.90141/)
    const row = () => cy.get('.go__places li').first()
    row().find('.nearby__list li').should('have.length', 3)
    row().find('.nearby__list li').first().should('contain', 'Little River Park').and('contain', '11 min drive · 4.8 mi').and('contain', '1 checklist all time').and('contain', 'sneaky pick')
    row().find('.nearby__list li').eq(1).should('contain', 'Sardis Creek Park').and('contain', '2.9 mi as the crow flies').and('not.contain', 'sneaky')
    row().find('.nearby__list li').eq(2).should('contain', 'Wahoo Park').and('contain', '4 min drive')
    // The map: focused, other pins faded, three public pins, three lines (two by road, one straight), minutes on the roads.
    cy.get('.sightings-map.is-focused').should('exist')
    cy.get('.sightings-map .map-pin--public').should('have.length', 3)
    cy.get('.sightings-map .map-road:not(.map-road--casing)').should('have.length', 3)
    cy.get('.sightings-map .map-road--straight').should('have.length', 1)
    // No labels on the map; the pins carry the list numbers and a tap reveals that pin's drive.
    cy.get('.sightings-map .map-road__label').should('not.exist')
    cy.get('.sightings-map .map-pin--public .map-pin__count').should('have.length', 3).first().should('have.text', '1')
    row().find('.nearby__n').should('have.length', 3).first().should('have.text', '1')
    cy.get('.sightings-map .map-pin--park').click()
    cy.get('.leaflet-popup').should('contain', '3. Wahoo Park').and('contain', '4 min drive · 1.2 mi')
    cy.get('.go__places li.is-current').should('contain', "Rusty's Gainesville Yard")
    cy.get('.go__places li').eq(1).find('.nearby__ask').should('not.exist')
    // Tapping outside the list and the map closes it and the map goes back to all the pins.
    cy.get('.go__title').click()
    cy.get('.nearby__list').should('not.exist')
    cy.get('.sightings-map.is-focused').should('not.exist')
    cy.get('.sightings-map .map-pin--public').should('have.length', 0)
    row().find('.nearby__ask').should('exist')
  })
})
