import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const event = {
  id: 5, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30,
  starts_on: day(6), ends_on: day(6), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(-15), active: false,
  role: 'organizer', members: [{ display_name: 'Matt', role: 'organizer', you: true }],
  targets: [{ code: 'eletro' }, { code: 'mexchi' }, { code: 'whepar' }], tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456'
}

const report = (over = {}) => ({
  code: 'eletro', comName: 'Elegant Trogon', locName: 'Cave Creek Canyon', locId: 'L123', lat: 31.88, lng: -109.17,
  obsDt: `${day(-1)} 07:30`, birders: 3, confirmed: true, media: true, subId: 'S100', ...over
})

const BIRDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']
const scouting = {
  checked_at: new Date().toISOString(), days_to_go: 6, using: 'targets',
  reported: [
    report(),
    report({ code: 'mexchi', comName: 'Mexican Chickadee', locName: 'Rustler Park', locId: 'L200', lat: 31.9, lng: -109.27, subId: 'S200' }),
    ...BIRDS.map(code => report({ code, comName: `Bird ${code}`, locName: 'Rustler Park', locId: 'L200', lat: 31.9, lng: -109.27, subId: `S${code}`, confirmed: null })),
    report({ code: 'x1', comName: 'Other One', locName: 'Portal', locId: 'L300', lat: 31.91, lng: -109.14, subId: 'S300' })
  ],
  unreported: [{ code: 'whepar', comName: 'Whiskered Screech-Owl' }]
}

const routed = (over = {}) => ({
  from: null,
  stops: [
    { n: 1, locId: 'L200', locName: 'Rustler Park', lat: 31.9, lng: -109.27, new_birds: [{ code: 'mexchi', comName: 'Mexican Chickadee' }, ...BIRDS.map(code => ({ code, comName: `Bird ${code}` }))], leg_min: null, leg_mi: null },
    { n: 2, locId: 'L123', locName: 'Cave Creek Canyon', lat: 31.88, lng: -109.17, new_birds: [{ code: 'eletro', comName: 'Elegant Trogon' }], leg_min: 42, leg_mi: 28 },
    { n: 3, locId: 'L400', locName: 'Southwestern Research Station', lat: 31.87, lng: -109.2, new_birds: [{ code: 'zz', comName: 'Zone-tailed Hawk' }], leg_min: 148, leg_mi: 84 }
  ],
  total_min: 190, total_mi: 112, covered: 11, reported: 12, skipped: 1,
  geometry: [[31.9, -109.27], [31.89, -109.22], [31.88, -109.17], [31.87, -109.2]],
  routed: true,
  ...over
})

const open = ({ route, user = TEST_USER, geo = null } = {}) => {
  stubAuth({ loggedIn: true, user })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: scouting }).as('scouting')
  cy.intercept('GET', '**/api/saved?kind=event-route*', (req) => {
    const from = new URL(req.url).searchParams.get('from')
    req.reply({ statusCode: 200, body: typeof route === 'function' ? route(from) : route })
  }).as('route')
  cy.visit('http://localhost:3000/events/5', geo ? { onBeforeLoad: (win) => cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(geo) } : undefined)
  cy.wait('@scouting')
}

describe('Event route', () => {
  it('plans a route only when asked: headline, ordered stops with legs and chips, Maps links, and the map in route order', () => {
    let asked = 0
    open({ route: () => { asked += 1; return routed() } })
    cy.get('[data-testid="scout-place"]').should('have.length', 3)
    cy.get('.map-pin').should('have.length', 3)
    cy.wrap(null).then(() => expect(asked).to.equal(0))

    cy.contains('button', 'Plan a route').should('have.attr', 'aria-expanded', 'false').click()
    cy.wait('@route').its('request.url').should('include', 'id=5').and('not.include', 'from=')
    cy.get('[data-testid="event-route"]').within(() => {
      cy.get('.event-route__headline').should('have.text', '3 stops · about 3 h 10 min of driving · 112 mi')
      cy.get('.event-route__headline strong').should('have.text', '3 stops')
      cy.get('.event-route__covers').should('have.text', 'Covers 11 of 12 targets reported this week')
      cy.contains('Drive times aren’t available').should('not.exist')
      cy.get('[data-testid="route-stop"]').should('have.length', 3)
      cy.get('.event-scouting__place-name').then(els => expect([...els].map(e => e.textContent)).to.deep.equal(['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station']))
      cy.get('.event-route__leg').then(els => expect([...els].map(e => e.textContent)).to.deep.equal(['↓ 42 min · 28 mi', '↓ 2 h 28 min · 84 mi']))
      cy.get('[data-testid="route-stop"]').first().within(() => {
        cy.get('.event-scouting__num').should('have.text', '1')
        cy.get('.event-route__leg').should('not.exist')
        cy.get('.event-scouting__count').should('have.text', '+9 new')
        // Five chips, then the rest behind a button; chips link to their reports like the place cards.
        cy.get('a.event-scouting__bird').should('have.length', 5)
        cy.contains('a.event-scouting__bird', 'Mexican Chickadee').should('have.attr', 'href', '/sighting/mexchi/S200')
        cy.contains('button', '+4 more').click()
        cy.get('a.event-scouting__bird').should('have.length', 9)
        cy.get('a.event-route__directions').should('have.text', 'Directions')
          .and('have.attr', 'href', 'https://www.google.com/maps/dir/?api=1&destination=31.9,-109.27').and('have.attr', 'target', '_blank')
      })
      // A bird with no report on the page is a plain chip.
      cy.get('[data-testid="route-stop"]').eq(2).find('span.event-scouting__bird').should('have.text', 'Zone-tailed Hawk')
      cy.get('a.event-route__maps').should('have.text', 'Open whole route in Google Maps').and('have.attr', 'target', '_blank').invoke('attr', 'href').then(href => {
        const url = new URL(href)
        expect(url.origin + url.pathname).to.equal('https://www.google.com/maps/dir/')
        expect(url.searchParams.get('api')).to.equal('1')
        expect(url.searchParams.get('origin')).to.equal('31.9,-109.27')
        expect(url.searchParams.get('destination')).to.equal('31.87,-109.2')
        expect(url.searchParams.get('waypoints')).to.equal('31.88,-109.17')
      })
      cy.get('.event-route__note').last().should('have.text', '1 other place only has birds you’d already see.')
    })
    // The map draws the route, its stops numbered in route order, and the place pins step aside.
    cy.get('.event-scouting__map .sightings-map').should('have.class', 'has-route')
    cy.get('.event-scouting__map path.map-route').should('exist')
    cy.get('.event-scouting__map .map-stop').then(els => expect([...els].map(e => e.textContent)).to.deep.equal(['1', '2', '3']))
    cy.get('.event-scouting__map .map-pin').should('not.exist')
    cy.get('[data-testid="scout-place"]').should('not.exist')

    cy.contains('button', 'Hide route').should('have.attr', 'aria-expanded', 'true').click()
    cy.get('[data-testid="event-route"]').should('not.exist')
    cy.get('[data-testid="scout-place"]').should('have.length', 3)
    cy.get('.event-scouting__map .map-pin').should('have.length', 3)
    cy.get('.event-scouting__map .map-stop').should('not.exist')
  })

  it('without drive times: no totals or legs, a note, stops still in order', () => {
    open({ route: routed({ routed: false, total_min: null, total_mi: null, skipped: 0, stops: routed().stops.map(s => ({ ...s, leg_min: null, leg_mi: null })) }) })
    cy.contains('button', 'Plan a route').click()
    cy.get('[data-testid="event-route"]').within(() => {
      cy.get('.event-route__headline').should('have.text', '3 stops')
      cy.contains('Drive times aren’t available right now — stops are in a sensible order.')
      cy.get('.event-route__leg').should('not.exist')
      cy.get('[data-testid="route-stop"]').should('have.length', 3)
      cy.contains('already see').should('not.exist')
    })
    cy.get('.event-scouting__map .map-stop').should('have.length', 3)
  })

  it('starts from the viewer’s location, rounded, when asked; a refusal says so', () => {
    let refuse = false
    open({
      route: (from) => (from ? routed({ from: { lat: 31.95, lng: -109.31 }, stops: routed().stops.map((s, i) => (i ? s : { ...s, leg_min: 20, leg_mi: 9 })) }) : routed()),
      geo: (ok, fail) => (refuse ? fail({ code: 1, message: 'User denied Geolocation' }) : ok({ coords: { latitude: 31.94823, longitude: -109.31177, accuracy: 30 } }))
    })
    cy.contains('button', 'Plan a route').click()
    cy.wait('@route')
    cy.contains('button', 'Start from my location').click()
    cy.wait('@route').its('request.url').should('include', 'from=31.95%2C-109.31')
    cy.get('[data-testid="event-route"]').within(() => {
      cy.contains('Starting from your location.')
      cy.get('[data-testid="route-stop"]').first().find('.event-route__leg').should('have.text', '↓ 20 min · 9 mi')
      cy.get('a.event-route__maps').invoke('attr', 'href').then(href => {
        const url = new URL(href)
        expect(url.searchParams.get('origin')).to.equal('31.95,-109.31')
        expect(url.searchParams.get('destination')).to.equal('31.87,-109.2')
        expect(url.searchParams.get('waypoints')).to.equal('31.9,-109.27|31.88,-109.17')
      })
      cy.contains('button', 'Don’t use my location').click()
      cy.contains('button', 'Start from my location')
      cy.wrap(null).then(() => { refuse = true })
      cy.contains('button', 'Start from my location').click()
      cy.contains('[role="status"]', 'Couldn’t get your location, so the route starts at the first stop.')
      cy.get('[data-testid="route-stop"]').should('have.length', 3)
    })
  })

  it('lists the optional stops lightly, marks personal and merged spots, and starts at the meeting point', () => {
    const extras = [
      { locId: 'L500', locName: 'Paradise', lat: 31.93, lng: -109.22, new_birds: [{ code: 'zz', comName: 'Zone-tailed Hawk' }, { code: 'x1', comName: 'Other One' }, { code: 'e3', comName: 'Extra Three' }], add_min: 69, add_mi: 38, private: false, merged: [] },
      { locId: 'P900', locName: 'Our feeder', lat: 31.6, lng: -109.4, new_birds: [{ code: 'e4', comName: 'Extra Four' }], add_min: 95, add_mi: 51, private: true, merged: [] },
      ...[1, 2, 3].map(k => ({ locId: `L6${k}`, locName: `Far Place ${k}`, lat: 31.5 - k / 10, lng: -109.5 - k / 10, new_birds: [{ code: `f${k}`, comName: `Far Bird ${k}` }], add_min: 120 + k, add_mi: 70 + k, private: false, merged: [] }))
    ]
    const base = routed()
    const stops = base.stops.map((s, i) => (i === 0 ? { ...s, private: false, merged: [{ locId: 'P1', locName: 'Backyard' }] } : i === 1 ? { ...s, merged: [{ locId: 'P2', locName: 'A' }, { locId: 'P3', locName: 'B' }] } : { ...s, locId: 'P400', private: true }))
    open({ route: routed({ from: { lat: 31.97, lng: -109.3 }, stops: stops.map((s, i) => (i ? s : { ...s, leg_min: 15, leg_mi: 7 })), extras, covered_with_extras: 12, covered: 9 }) })
    cy.contains('button', 'Plan a route').click()
    cy.wait('@route').its('request.url').should('not.include', 'from=')
    cy.get('[data-testid="event-route"]').within(() => {
      cy.get('.event-route__covers').should('have.text', 'Covers 9 of 12 targets reported this week · 12 with the extras')
      cy.contains('.event-route__start', 'Starting from the event’s meeting point.')
      cy.contains('button', 'Start from my location')
      cy.get('a.event-route__maps').invoke('attr', 'href').should('include', 'origin=31.97%2C-109.3')
      // Personal and merged spots.
      cy.get('[data-testid="route-stop"]').eq(0).within(() => {
        cy.get('.event-route__tag').should('not.exist')
        cy.get('.event-route__merged').should('have.text', 'Includes reports from 1 nearby personal spot')
      })
      cy.get('[data-testid="route-stop"]').eq(1).find('.event-route__merged').should('have.text', 'Includes reports from 2 nearby personal spots')
      cy.get('[data-testid="route-stop"]').eq(2).within(() => {
        cy.get('.event-route__tag').should('have.text', 'personal spot')
        cy.get('.event-route__merged').should('not.exist')
      })
      // The extras: after the stops, no numbers, three then the rest behind a button.
      cy.get('[data-testid="route-extras"]').within(() => {
        cy.get('.place__subheading').should('have.text', 'Worth it if you have time')
        cy.get('[data-testid="route-extra"]').should('have.length', 3)
        cy.get('.event-scouting__num').should('not.exist')
        cy.get('[data-testid="route-extra"]').first().within(() => {
          cy.get('.event-scouting__place-name').should('have.text', 'Paradise')
          cy.get('.event-route__extra-cost').should('have.text', '+3 birds · +1 h 9 min · 38 mi')
          cy.get('.event-scouting__bird').should('have.length', 3)
          cy.get('a.event-route__directions').should('have.attr', 'href', 'https://www.google.com/maps/dir/?api=1&destination=31.93,-109.22')
        })
        cy.get('[data-testid="route-extra"]').eq(1).find('.event-route__tag').should('have.text', 'personal spot')
        cy.contains('button', 'Show 2 more').click()
        cy.get('[data-testid="route-extra"]').should('have.length', 5)
      })
    })
    cy.get('.event-route__stops').nextAll('[data-testid="route-extras"]').should('have.length', 1)
    // Extras are small grey pins without numbers; the route's stops keep theirs.
    cy.get('.event-scouting__map .map-pin--muted').should('have.length', 5)
    cy.get('.event-scouting__map .map-pin--muted .map-pin__count').should('not.exist')
    cy.get('.event-scouting__map .map-stop:not(.map-stop--start)').should('have.length', 3)
  })

  it('tapping an extra’s pin reveals and scrolls to its row', () => {
    const extras = [1, 2, 3, 4, 5].map(k => ({ locId: `L6${k}`, locName: `Far Place ${k}`, lat: 31.5 - k / 10, lng: -109.5 - k / 10, new_birds: [{ code: `f${k}`, comName: `Far Bird ${k}` }], add_min: null, add_mi: null }))
    open({ route: routed({ routed: false, extras, covered_with_extras: 11 }) })
    cy.contains('button', 'Plan a route').click()
    cy.get('[data-testid="route-extra"]').should('have.length', 3).first().find('.event-route__extra-cost').should('have.text', '+1 bird')
    // covered_with_extras no higher than covered: the plain line.
    cy.get('.event-route__covers').should('have.text', 'Covers 11 of 12 targets reported this week')
    cy.get('.event-scouting__map .map-pin--muted').eq(4).click({ force: true })
    cy.get('[data-testid="route-extra"]').should('have.length', 5)
    cy.get('#route-extra-4').should('have.class', 'is-active').and('contain', 'Far Place 5')
    cy.get('#route-extra-4').should(el => {
      const r = el[0].getBoundingClientRect()
      expect(r.top).to.be.lessThan(Cypress.config('viewportHeight'))
      expect(r.bottom).to.be.greaterThan(0)
    })
  })

  it('reads in kilometres outside the US', () => {
    open({ route: routed(), user: { ...TEST_USER, state: 'ON' } })
    cy.contains('button', 'Plan a route').click()
    cy.get('.event-route__headline').should('have.text', '3 stops · about 3 h 10 min of driving · 180.2 km')
  })

  it('a failed plan says so', () => {
    open({ route: routed() })
    cy.intercept('GET', '**/api/saved?kind=event-route*', { statusCode: 500, body: { error: 'boom' } })
    cy.contains('button', 'Plan a route').click()
    cy.contains('[data-testid="event-route"]', 'Couldn’t plan a route right now. Try again in a bit.')
  })

  it('fits a phone without scrolling sideways', () => {
    cy.viewport(375, 740)
    const longName = (s) => ({ ...s, private: true, merged: [{ locId: 'P1', locName: 'Yard' }], locName: `${s.locName} trailhead parking area and very long picnic ground name` })
    const long = routed({
      stops: routed().stops.map(longName),
      extras: [longName({ locId: 'L500', locName: 'Paradise', lat: 31.93, lng: -109.22, new_birds: [{ code: 'zz', comName: 'Zone-tailed Hawk of the very long name' }], add_min: 69, add_mi: 38 })],
      covered_with_extras: 12, covered: 9
    })
    open({ route: long })
    cy.contains('button', 'Plan a route').click()
    cy.get('[data-testid="route-stop"]').should('have.length', 3)
    cy.get('a.event-route__maps').should('be.visible')
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
  })
})
