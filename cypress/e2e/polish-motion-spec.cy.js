import { login } from '../support/login'

describe('Polish: motion', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('a shown route draws itself once the map is in view, and edits run on or retrace instead of flashing', () => {
    // A phone: the button sits above the map, which starts below the fold.
    cy.viewport(390, 844)
    // The drive comes back along the stops it was asked for, after a moment, like the real one.
    cy.intercept('GET', '**/api/ebird/drive*', (req) => {
      const points = new URL(req.url).searchParams.get('points').split(';').map((p) => p.split(',').map(Number))
      req.reply({ delay: 400, body: { minutes: 20, miles: 9, legs: points.slice(1).map(() => ({ minutes: 10, miles: 4.5 })), geometry: points } })
    }).as('drive')
    cy.get('.alerts-go-link').click()
    cy.wait('@whereToGo')
    cy.contains('button', 'Show route on map').click()
    // The map comes up under the bar, and the line is held back, then runs out from the start.
    cy.get('.go__frame').should(($f) => expect($f[0].getBoundingClientRect().top).to.be.lessThan(120))
    cy.get('.sightings-map path.map-route:not(.map-route--casing)').should(($p) => expect(parseFloat($p[0].style.strokeDashoffset)).to.be.greaterThan(0))
    cy.get('.sightings-map').should('have.attr', 'data-drawn', 'first')
    // Each stop's pop waits for the line to reach it: later stops later.
    cy.get('.sightings-map .map-stop:not(.map-stop--start).is-popping').then(($stops) => {
      const delays = [...$stops].map((el) => parseInt(el.style.animationDelay, 10))
      expect(delays.length).to.eq(2)
      expect(delays[1]).to.be.greaterThan(delays[0])
    })
    cy.get('.sightings-map path.map-route:not(.map-route--casing)').should(($p) => expect($p[0].style.strokeDasharray).to.eq(''))

    // Edits redraw rather than flash a straight stand-in while the roads come: a changed route
    // retraces, quicker; a stop added on the end keeps the line and runs it on to the new stop, which
    // pops as the line arrives.
    const hotspot = (name, locId, lat, lng) => ({ kind: 'hotspot', locId, name, county: 'US-GA-139', lat, lng, species: 70, checklists: 30, latest: '2026-08-15' })
    cy.intercept('GET', '**/api/ebird/place-search*', (req) => {
      req.reply({ hotspots: [String(req.query.q).startsWith('yah') ? hotspot('Yahoola Creek Park', 'L22341308', 34.5296831, -83.960756) : hotspot('Wahoo Park', 'L5', 34.37, -83.8)], addresses: [] })
    })
    const add = (q, name) => {
      cy.get('.go__add input').clear({ force: true })
      cy.get('.go__add input').type(q, { force: true })
      cy.contains('.go__add .place-search__results button', name).click({ force: true })
    }
    cy.contains('button', 'Edit route').click({ force: true })
    cy.get('[aria-label="Remove Rusty\'s Gainesville Yard"]').click({ force: true })
    add('yahoola', 'Yahoola Creek Park')
    cy.wait('@drive')
    cy.get('.sightings-map').should('have.attr', 'data-drawn', 'retrace')
    add('wahoo', 'Wahoo Park')
    cy.wait('@drive')
    cy.get('.sightings-map').should('have.attr', 'data-drawn', 'extend')
    cy.get('.sightings-map .map-stop:not(.map-stop--start).is-popping').should('have.length', 1).and('have.text', '3')
    cy.get('[aria-label="Move Wahoo Park up"]').click({ force: true })
    cy.wait('@drive')
    cy.get('.sightings-map').should('have.attr', 'data-drawn', 'retrace')
  })

  it('moving to another page fades it in, without reloading it', () => {
    // A fresh load starts without a fade; signing in above already moved from /login to home.
    cy.visit('http://localhost:3000/')
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('.route-view').should('not.have.attr', 'data-last-transition')
    cy.get('#settingsText').click({ force: true })
    cy.url().should('include', '/settings')
    cy.get('.route-view').should('have.attr', 'data-last-transition', '/settings')
    cy.contains('h2', 'Alert center')
  })
})
