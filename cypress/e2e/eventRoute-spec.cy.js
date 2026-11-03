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

const STORE_KEY = 'bird-alert:event-route:5'

const open = ({ route, user = TEST_USER, geo = null, stored = null, setup = null, plan = { record: { start: null, stops: null, version: 0 } }, path = '/events/5', beforeLoad = null } = {}) => {
  stubAuth({ loggedIn: true, user })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: scouting }).as('scouting')
  cy.intercept('GET', '**/api/saved?kind=event-route*', (req) => {
    const params = new URL(req.url).searchParams
    const body = typeof route === 'function' ? route(params.get('from'), params) : route
    req.reply(body && body.statusCode ? body : { statusCode: 200, body })
  }).as('route')
  // The group's saved route, kept by a fake server: versions, a 409 with the current record when stale.
  cy.intercept('GET', '**/api/saved?kind=event-route-plan*', (req) => req.reply({ statusCode: 200, body: plan.record })).as('plan')
  cy.intercept('PUT', '**/api/saved?kind=event-route-plan*', (req) => {
    if (plan.fail) { plan.fail -= 1; return req.reply({ statusCode: 500, body: { error: 'boom' } }) }
    if (req.body.version !== plan.record.version) return req.reply({ statusCode: 409, body: { error: 'Someone changed the route', current: plan.record } })
    plan.record = { start: req.body.start, stops: req.body.stops, version: plan.record.version + 1, updated_at: new Date().toISOString(), updated_by_name: 'Matt', updated_by_you: true }
    // The server adds what it works out: each stop's suggested stay, the legs and totals.
    if (plan.decorate) plan.record = plan.decorate(plan.record)
    req.reply({ statusCode: 200, body: plan.record })
  }).as('savePlan')
  cy.intercept('DELETE', '**/api/saved?kind=event-route-plan*', (req) => {
    if (Number(new URL(req.url).searchParams.get('version')) !== plan.record.version) return req.reply({ statusCode: 409, body: { error: 'Someone changed the route', current: plan.record } })
    plan.record = { start: null, stops: null, version: plan.record.version + 1 }
    req.reply({ statusCode: 200, body: plan.record })
  }).as('deletePlan')
  cy.intercept('GET', '**/api/ebird/place-search*', (req) => {
    const params = new URL(req.url).searchParams
    const q = params.get('q') ?? ''
    req.reply({ statusCode: 200, body: {
      hotspots: q.toLowerCase().startsWith('port') ? [{ locId: 'L777', name: 'Portal Peak Lodge', lat: 31.9144, lng: -109.1411, county: COCHISE, species: 210 }] : [],
      addresses: params.get('addresses') ? [{ name: 'Portal, Arizona, United States', lat: 31.9137, lng: -109.1412 }] : []
    } })
  }).as('placeSearch')
  if (setup) setup()
  cy.visit(`http://localhost:3000${path}`, { onBeforeLoad: (win) => {
    if (beforeLoad) beforeLoad(win)
    if (stored) win.localStorage.setItem(STORE_KEY, JSON.stringify(stored))
    if (geo) cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(geo)
  } })
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
      cy.contains('.event-route__start-name', 'Starting from the event’s meeting point.')
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

  describe('the group’s route', () => {
    // The suggestion, with every place's targets (`species`) and their names, for coverage worked out here.
    const suggestion = (over = {}) => routed({
      stops: routed().stops.map((s, i) => ({ ...s, species: [['mexchi', 'b1', 'b2'], ['eletro', 'mexchi'], ['zz']][i] })),
      extras: [{ locId: 'L500', locName: 'Paradise', lat: 31.93, lng: -109.22, new_birds: [{ code: 'pa', comName: 'Painted Redstart' }], add_min: 69, add_mi: 38, species: ['pa', 'zz'] }],
      names: { mexchi: 'Mexican Chickadee', b1: 'Bird b1', b2: 'Bird b2', eletro: 'Elegant Trogon', zz: 'Zone-tailed Hawk', pa: 'Painted Redstart' },
      covered: 5, reported: 7, skipped: 0,
      ...over
    })
    // The drive between the stops in the order given: 10 min and 5 mi a leg.
    const stubDrive = () => cy.intercept('GET', '**/api/ebird/drive*', (req) => {
      const points = new URL(req.url).searchParams.get('points').split(';').map(p => p.split(',').map(Number))
      const legs = points.slice(1).map(() => ({ minutes: 10, miles: 5 }))
      req.reply({ statusCode: 200, body: { minutes: legs.length * 10, miles: legs.length * 5, geometry: points, legs } })
    }).as('drive')
    const names = (sel) => cy.get(sel).then(els => [...els].map(e => e.textContent))
    const editorStops = () => names('[data-testid="route-editor"] .go__stop-text strong')
    const cardStops = () => names('[data-testid="route-stop"] .event-scouting__place-name')
    const twoStops = [{ locId: 'L400', name: 'Southwestern Research Station', lat: 31.87, lng: -109.2 }, { locId: 'L123', name: 'Cave Creek Canyon', lat: 31.88, lng: -109.17 }]
    const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString()

    it('nothing saved: the suggestion, with Edit route to start the group’s own', () => {
      const server = { record: { start: null, stops: null, version: 0 } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.wait('@plan')
      cardStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      cy.get('.event-route__heading').should('not.exist')
      cy.contains('.event-route__start-name', 'Starting at the first stop.')
      cy.contains('button', 'Back to the suggested route').should('not.exist')
      cy.contains('button', 'Edit route')
      cy.contains('Start somewhere else').should('not.exist')
    })

    // The scouting email's route buttons link to /events/<id>#route.
    const inView = () => cy.get('#route').should(el => {
      const r = el[0].getBoundingClientRect()
      expect(r.top).to.be.within(0, 200)
    })

    it('#route opens the suggestion when nothing is saved, and scrolls to it', () => {
      cy.viewport(375, 667)
      open({ route: suggestion(), setup: stubDrive, path: '/events/5#route' })
      cy.wait('@plan')
      cy.wait('@route')
      cy.contains('button', 'Hide route').should('have.attr', 'aria-expanded', 'true').and('have.id', 'route')
      cardStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      cy.get('.event-route__heading').should('not.exist')
      cy.window().its('scrollY').should('be.greaterThan', 0)
      inView()
    })

    it('#route opens the group’s saved route instead, and jumps there with reduced motion', () => {
      cy.viewport(375, 667)
      const server = { record: { start: { name: 'Portal Store', lat: 31.91, lng: -109.14 }, stops: twoStops, version: 3, updated_at: ago(130), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive, path: '/events/5#route', beforeLoad: (win) => {
        const real = win.matchMedia.bind(win)
        cy.stub(win, 'matchMedia').callsFake(q => (q.includes('prefers-reduced-motion') ? { matches: true, media: q, addEventListener () {}, removeEventListener () {}, addListener () {}, removeListener () {} } : real(q)))
        cy.spy(win.Element.prototype, 'scrollIntoView').as('scrollIntoView')
      } })
      cy.wait('@plan')
      cy.get('.event-route__heading').should('have.text', 'Your group’s route · edited by Sam · 2 hours ago')
      cardStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      cy.get('@scrollIntoView').should('have.been.calledWithMatch', { behavior: 'auto' })
      cy.get('@scrollIntoView').should('not.have.been.calledWithMatch', { behavior: 'smooth' })
      inView()
    })

    it('without #route the route stays closed', () => {
      open({ route: suggestion(), setup: stubDrive })
      cy.contains('button', 'Plan a route').should('have.attr', 'aria-expanded', 'false')
      cy.get('[data-testid="route-stop"]').should('not.exist')
    })

    it('a saved route shows instead of the suggestion, with who edited it and when', () => {
      const server = { record: { start: { name: 'Portal Store', lat: 31.91, lng: -109.14 }, stops: twoStops, version: 3, updated_at: ago(130), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.wait('@plan').its('request.url').should('include', 'id=5')
      cy.wait('@drive')
      cy.get('.event-route__heading').should('have.text', 'Your group’s route · edited by Sam · 2 hours ago')
      cardStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      cy.contains('.event-route__start-name', 'Meeting point: Portal Store.')
      cy.get('.event-route__covers').should('have.text', 'Covers 3 of 7 targets reported this week')
      cy.get('.event-route__headline').should('have.text', '2 stops · about 20 min of driving · 10 mi')
      cy.get('.event-scouting__map .map-stop:not(.map-stop--start)').should('have.length', 2)
      cy.get('.event-scouting__map .map-stop--start').should('have.length', 1)
      cy.get('[data-testid="route-extras"]').should('not.exist')
    })

    it('edits save to the group a moment after the last one, with the version they were made on', () => {
      const server = { record: { start: null, stops: null, version: 0 } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.wait('@plan')
      cy.contains('button', 'Edit route').click()
      cy.get('[data-testid="route-editor"] .go__start-label').should('have.text', 'Meeting point')
      editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      // Two quick edits, one save.
      cy.get('[aria-label="Move Rustler Park down"]').click()
      cy.get('[aria-label="Remove Southwestern Research Station"]').click()
      editorStops().should('deep.equal', ['Cave Creek Canyon', 'Rustler Park'])
      cy.contains('.event-route__save', 'Saved')
      cy.get('@savePlan.all').should('have.length', 1)
      cy.get('@savePlan').its('request.body').should('deep.equal', {
        start: null, version: 0,
        stops: [{ locId: 'L123', name: 'Cave Creek Canyon', lat: 31.88, lng: -109.17, stay_min: null }, { locId: 'L200', name: 'Rustler Park', lat: 31.9, lng: -109.27, stay_min: null }]
      })
      // The next edit goes with the new version: add from the list, and a meeting point typed as coordinates.
      cy.contains('[data-testid="route-editor"] .place-search__results button', 'Paradise').should('contain', '+2 birds').click()
      cy.contains('.event-route__save', 'Saved')
      cy.get('@savePlan').its('request.body.version').should('equal', 1)
      cy.contains('[data-testid="route-editor"] .go__start button', 'Set').click()
      cy.get('[data-testid="route-editor"] .go__start-picker input[type="search"]').type('31.9512, -109.3133')
      cy.contains('[data-testid="route-editor"] .go__start-picker button', 'Use 31.9512, -109.3133').click()
      cy.get('@savePlan.all').should('have.length', 3).its(2).its('request.body').should('deep.include', { start: { name: '31.9512, -109.3133', lat: 31.9512, lng: -109.3133 }, version: 2 })
      cy.contains('[data-testid="route-editor"] button', 'Done').click()
      cy.get('.event-route__heading').should('contain', 'Your group’s route · edited by you · just now')
      cardStops().should('deep.equal', ['Cave Creek Canyon', 'Rustler Park', 'Paradise'])
    })

    it('someone else’s newer save wins: their route comes in and says who changed it', () => {
      const server = { record: { start: null, stops: twoStops, version: 4, updated_at: ago(5), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.wait('@plan')
      cy.contains('button', 'Edit route').click()
      // Meanwhile Sam saves version 5 with one stop.
      cy.wrap(null).then(() => { server.record = { start: null, stops: [twoStops[1]], version: 5, updated_at: ago(0), updated_by_name: 'Sam' } })
      cy.get('[aria-label="Remove Southwestern Research Station"]').click()
      cy.wait('@savePlan').its('response.statusCode').should('equal', 409)
      cy.contains('[role="status"]', 'Sam just changed the route.')
      editorStops().should('deep.equal', ['Cave Creek Canyon'])
      cy.contains('.event-route__save', 'Saved').should('not.exist')
    })

    it('a failed save keeps the edit on screen, to try again', () => {
      const server = { record: { start: null, stops: twoStops, version: 1 }, fail: 1 }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.contains('button', 'Edit route').click()
      cy.get('[aria-label="Move Southwestern Research Station down"]').click()
      cy.contains('.event-route__save', 'Couldn’t save the route.')
      editorStops().should('deep.equal', ['Cave Creek Canyon', 'Southwestern Research Station'])
      cy.contains('.event-route__save button', 'Try again').click()
      cy.contains('.event-route__save', 'Saved')
      cy.wrap(null).then(() => expect(server.record.stops.map(s => s.locId)).to.deep.equal(['L123', 'L400']))
    })

    it('back to the suggested route asks first, then clears it for everyone', () => {
      const server = { record: { start: null, stops: twoStops, version: 2, updated_at: ago(30), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.wait('@plan')
      cy.contains('button', 'Back to the suggested route').click()
      cy.contains('[role="alert"]', 'Go back to the suggested route? This clears the route for everyone in the group.')
      cy.contains('[role="alert"] button', 'Cancel').click()
      cy.get('@deletePlan.all').should('have.length', 0)
      cy.contains('button', 'Back to the suggested route').click()
      cy.contains('[role="alert"] button', 'Go back').click()
      cy.wait('@deletePlan').its('request.url').should('include', 'version=2')
      cardStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      cy.get('.event-route__heading').should('not.exist')
      cy.contains('button', 'Back to the suggested route').should('not.exist')
    })

    it('offers a route made on this device before routes were shared, once', () => {
      const server = { record: { start: null, stops: null, version: 0 } }
      open({ route: suggestion(), plan: server, setup: stubDrive, stored: { start: null, stops: twoStops } })
      cy.contains('button', 'Plan a route').click()
      cy.contains('[role="alert"]', 'Save the route you made earlier for the group?').contains('button', 'Save').click()
      cy.wait('@savePlan').its('request.body').should('deep.equal', { start: null, stops: twoStops.map(s => ({ ...s, stay_min: null })), version: 0 })
      cardStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      cy.window().then(win => expect(win.localStorage.getItem(STORE_KEY)).to.equal(null))
      cy.contains('Save the route you made earlier').should('not.exist')
    })

    it('discarding the old route clears it; a group that has a route never sees the offer', () => {
      open({ route: suggestion(), plan: { record: { start: null, stops: null, version: 0 } }, setup: stubDrive, stored: { start: null, stops: twoStops } })
      cy.contains('button', 'Plan a route').click()
      cy.contains('[role="alert"]', 'Save the route you made earlier for the group?').contains('button', 'Discard').click()
      cy.contains('Save the route you made earlier').should('not.exist')
      cy.window().then(win => expect(win.localStorage.getItem(STORE_KEY)).to.equal(null))
      cy.get('@savePlan.all').should('have.length', 0)
      cardStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])

      open({ route: suggestion(), plan: { record: { start: null, stops: [twoStops[0]], version: 1 } }, setup: stubDrive, stored: { start: null, stops: twoStops } })
      cy.contains('button', 'Plan a route').click()
      cardStops().should('deep.equal', ['Southwestern Research Station'])
      cy.contains('Save the route you made earlier').should('not.exist')
      cy.window().then(win => expect(win.localStorage.getItem(STORE_KEY)).to.equal(null))
    })

    it('says when some reports couldn’t be loaded', () => {
      open({ route: suggestion({ incomplete: true }), plan: { record: { start: null, stops: null, version: 0 } } })
      cy.contains('button', 'Plan a route').click()
      cy.contains('.event-route__note', 'Some reports couldn’t be loaded, so this may change on refresh.')
    })

    describe('time at each stop', () => {
      // The suggestion's stays: 45, 30 and 20 minutes, 1 h 35 min in all.
      const STAYS = [45, 30, 20]
      const timed = (over = {}) => suggestion({
        stops: suggestion().stops.map((s, i) => ({ ...s, suggested_stay_min: STAYS[i], targets_here: s.species.length })),
        stay_min_total: 95,
        ...over
      })
      // The saved route's stays as the server works them out: Southwestern 25, Cave Creek 40.
      const SUGGESTED = { L400: 25, L123: 40 }
      const decorate = (record) => {
        const stops = record.stops && record.stops.map(s => ({ ...s, suggested_stay_min: SUGGESTED[s.locId] ?? 30, targets_here: 1 }))
        const legs = stops && stops.map((_, i) => (i === 0 && !record.start ? null : { min: 24, mi: 12 }))
        const stay = stops ? stops.reduce((sum, s) => sum + (s.stay_min ?? s.suggested_stay_min), 0) : 0
        const drive = legs ? legs.reduce((sum, l) => sum + (l ? l.min : 0), 0) : null
        return { ...record, stops, legs, totals: { drive_min: drive, stay_min: stay, total_min: drive + stay }, routed: true }
      }
      const savedPlan = (stays = [null, null], over = {}) => ({
        decorate,
        record: decorate({ start: null, stops: twoStops.map((s, i) => ({ ...s, stay_min: stays[i] })), version: 1, updated_at: ago(5), updated_by_name: 'Sam', ...over })
      })
      const texts = (sel) => cy.get(sel).then(els => [...els].map(e => e.textContent))
      const stepper = (i) => cy.get('[data-testid="route-editor"] [data-testid="stop-stay"]').eq(i)
      const noDrive = () => cy.intercept('GET', '**/api/ebird/drive*', { statusCode: 500, body: { error: 'down' } }).as('drive')

      it('the suggestion shows each stop’s suggested stay and the whole day, read-only', () => {
        open({ route: timed(), setup: stubDrive })
        cy.contains('button', 'Plan a route').click()
        cy.wait('@plan')
        texts('[data-testid="route-stop"] .event-route__stay').should('deep.equal', ['Stay 45 min suggested', 'Stay 30 min suggested', 'Stay 20 min suggested'])
        cy.get('.event-route__stay-tag').should('have.length', 3)
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 3 h 10 min · At stops 1 h 35 min · Total 4 h 45 min')
        cy.get('[data-testid="route-totals"] strong').should('have.text', 'Total 4 h 45 min')
        cy.get('[data-testid="event-route"] [data-testid="stop-stay"]').should('not.exist')
      })

      it('a saved route: the group’s stays, the suggested tag, the drive into each stop, and totals', () => {
        open({ route: timed(), plan: savedPlan([60, null]), setup: stubDrive })
        cy.contains('button', 'Plan a route').click()
        cy.wait('@plan')
        cy.wait('@drive')
        texts('[data-testid="route-stop"] .event-route__stay').should('deep.equal', ['Stay 1 h', 'Stay 40 min suggested'])
        texts('[data-testid="route-stop"] .event-route__leg').should('deep.equal', ['↓ 10 min · 5 mi'])
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 40 min · Total 1 h 50 min')
      })

      it('when /ebird/drive can’t answer, the saved legs and drive total stand, in the viewer’s unit', () => {
        const plan = savedPlan([null, null], { start: { name: 'Portal Store', lat: 31.91, lng: -109.14 } })
        open({ route: timed(), plan, user: { ...TEST_USER, state: 'ON' }, setup: noDrive })
        cy.contains('button', 'Plan a route').click()
        cy.wait('@plan')
        texts('[data-testid="route-stop"] .event-route__leg').should('deep.equal', ['↓ 24 min · 19.3 km', '↓ 24 min · 19.3 km'])
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 48 min · At stops 1 h 5 min · Total 1 h 53 min')
        cy.contains('Drive times aren’t available').should('not.exist')
      })

      it('routed: false: no legs or drive total, the stops’ time still adds up', () => {
        const plan = savedPlan([null, 15])
        plan.record = { ...plan.record, legs: [null, null], totals: { drive_min: null, stay_min: 40, total_min: 40 }, routed: false }
        open({ route: timed(), plan, setup: noDrive })
        cy.contains('button', 'Plan a route').click()
        cy.wait('@plan')
        cy.get('[data-testid="route-stop"]').should('have.length', 2)
        cy.get('.event-route__leg').should('not.exist')
        cy.contains('.event-route__note', 'Drive times aren’t available right now.')
        cy.get('[data-testid="route-totals"]').should('have.text', 'At stops 40 min')
        cy.contains('button', 'Edit route').click()
        cy.get('[data-testid="route-editor"] [data-testid="route-totals"]').should('have.text', 'At stops 40 min')

        // The suggestion without drive times: the same.
        open({ route: timed({ routed: false, total_min: null, total_mi: null, stops: timed().stops.map(s => ({ ...s, leg_min: null, leg_mi: null })) }) })
        cy.contains('button', 'Plan a route').click()
        cy.get('[data-testid="route-totals"]').should('have.text', 'At stops 1 h 35 min')
      })

      it('the stepper: −/+ in fives, a typed time, use suggested; totals move at once and each change saves with its version', () => {
        const plan = savedPlan()
        open({ route: timed(), plan, setup: stubDrive })
        cy.contains('button', 'Plan a route').click()
        cy.wait('@plan')
        cy.contains('button', 'Edit route').click()
        stepper(1).within(() => {
          cy.get('.go__stay-value').should('have.text', '40 min')
          cy.contains('.go__stay-tag', 'suggested')
          cy.contains('button', 'use suggested').should('not.exist')
        })
        cy.get('[data-testid="route-editor"] [data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 5 min · Total 1 h 15 min')
        texts('[data-testid="route-editor"] .go__leg').should('deep.equal', ['↓ 10 min · 5 mi'])

        cy.get('[aria-label="More time at Cave Creek Canyon"]').click()
        // On screen before the save goes.
        stepper(1).find('.go__stay-value').should('have.text', '45 min')
        stepper(1).find('.go__stay-tag').should('not.exist')
        cy.get('[data-testid="route-editor"] [data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 10 min · Total 1 h 20 min')
        cy.get('@savePlan.all').should('have.length', 0)
        cy.wait('@savePlan').its('request.body').should('deep.equal', {
          start: null, version: 1,
          stops: [{ ...twoStops[0], stay_min: null }, { ...twoStops[1], stay_min: 45 }]
        })

        // Down in fives.
        cy.get('[aria-label="Less time at Southwestern Research Station"]').click()
        cy.get('[aria-label="Less time at Southwestern Research Station"]').click()
        stepper(0).find('.go__stay-value').should('have.text', '15 min')
        cy.wait('@savePlan').its('request.body').should('deep.include', { version: 2 }).its('stops').should('deep.equal', [{ ...twoStops[0], stay_min: 15 }, { ...twoStops[1], stay_min: 45 }])

        // Tap the time to type it; past the most it comes back to 8 h.
        stepper(1).find('.go__stay-value').click()
        cy.get('[aria-label="Minutes at Cave Creek Canyon"]').should('be.focused').clear()
        cy.get('[aria-label="Minutes at Cave Creek Canyon"]').type('90{enter}')
        stepper(1).find('.go__stay-value').should('have.text', '1 h 30 min')
        cy.get('[data-testid="route-editor"] [data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 45 min · Total 1 h 55 min')
        cy.wait('@savePlan').its('request.body.stops.1.stay_min').should('equal', 90)
        stepper(0).find('.go__stay-value').click()
        cy.get('[aria-label="Minutes at Southwestern Research Station"]').clear()
        cy.get('[aria-label="Minutes at Southwestern Research Station"]').type('999{enter}')
        stepper(0).find('.go__stay-value').should('have.text', '8 h')
        cy.get('[aria-label="More time at Southwestern Research Station"]').should('be.disabled')
        cy.wait('@savePlan').its('request.body.stops.0.stay_min').should('equal', 480)

        // Back to the suggestion for one stop.
        stepper(1).contains('button', 'use suggested').click()
        stepper(1).find('.go__stay-value').should('have.text', '40 min')
        stepper(1).contains('.go__stay-tag', 'suggested')
        cy.wait('@savePlan').its('request.body').should((body) => {
          expect(body.version).to.equal(5)
          expect(body.stops[1].stay_min).to.equal(null)
        })

        cy.contains('[data-testid="route-editor"] button', 'Done').click()
        texts('[data-testid="route-stop"] .event-route__stay').should('deep.equal', ['Stay 8 h', 'Stay 40 min suggested'])
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 8 h 40 min · Total 8 h 50 min')
      })

      it('the stepper fits a phone without scrolling sideways', () => {
        cy.viewport(375, 740)
        open({ route: timed(), plan: savedPlan([125, null]), setup: stubDrive })
        cy.contains('button', 'Plan a route').click()
        cy.contains('button', 'Edit route').click()
        stepper(0).contains('button', 'use suggested').should('be.visible')
        cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
      })
    })

    it('the editor fits a phone without scrolling sideways', () => {
      cy.viewport(375, 740)
      open({ route: suggestion(), plan: { record: { start: { name: 'A very long meeting point name at the trailhead parking area', lat: 31.9, lng: -109.2 }, stops: twoStops, version: 1, updated_by_name: null, updated_at: ago(3000) } }, setup: stubDrive })
      cy.contains('button', 'Plan a route').click()
      cy.get('.event-route__heading').should('have.text', 'Your group’s route · edited by a group member · 2 days ago')
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
      cy.contains('button', 'Edit route').click()
      cy.get('[data-testid="route-editor"] .go__stop').should('have.length', 2)
      cy.get('[data-testid="route-editor"] [data-testid="stop-stay"]').should('have.length', 2)
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
    })
  })

  it('the view-only page shows the group’s route, read-only, with no start', () => {
    cy.viewport(375, 740)
    stubAuth({ loggedIn: false })
    cy.intercept('GET', '**/api/saved?kind=event-view*', { statusCode: 200, body: {
      name: 'Chiricahuas', area: 'Cochise County, Arizona', starts_on: day(6), ends_on: day(6), kind: 'bigday', active: false,
      targets: [], tally: [], count: 0,
      route: { start: null, stops: [{ locId: 'L200', name: 'Rustler Park', lat: 31.9, lng: -109.27 }, { locId: null, name: 'A long-named pull-off on the Pinery Canyon road past the campground', lat: 31.88, lng: -109.17 }] }
    } }).as('view')
    cy.visit('http://localhost:3000/events/view/view456')
    cy.wait('@view')
    cy.get('[data-testid="view-route"]').within(() => {
      cy.contains('h2', 'The route')
      cy.get('.event-view__stops li').should('have.length', 2).first().should('have.text', '1Rustler Park')
      cy.get('.map-stop:not(.map-stop--start)').should('have.length', 2)
      cy.get('.map-stop--start').should('not.exist')
      cy.get('path.map-route').should('exist')
      cy.get('button, input').should('not.exist')
    })
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
  })

  it('the view-only page without a route has no route section', () => {
    stubAuth({ loggedIn: false })
    cy.intercept('GET', '**/api/saved?kind=event-view*', { statusCode: 200, body: { name: 'Chiricahuas', starts_on: day(6), ends_on: day(6), targets: [], tally: [], count: 0, route: null } }).as('view')
    cy.visit('http://localhost:3000/events/view/view456')
    cy.wait('@view')
    cy.get('.event-page__title').should('have.text', 'Chiricahuas')
    cy.get('[data-testid="view-route"]').should('not.exist')
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
