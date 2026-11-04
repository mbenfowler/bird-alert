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
    // plan.delay: a slow server, so Saving… shows for a while.
    const delay = plan.delay || 0
    if (plan.fail) { plan.fail -= 1; return req.reply({ statusCode: 500, body: { error: 'boom' }, delay }) }
    if (req.body.version !== plan.record.version) return req.reply({ statusCode: 409, body: { error: 'Someone changed the route', current: plan.record } })
    plan.record = { start: req.body.start, stops: req.body.stops, version: plan.record.version + 1, updated_at: new Date().toISOString(), updated_by_name: 'Matt', updated_by_you: true }
    // The server adds what it works out: each stop's suggested stay, the legs and totals.
    if (plan.decorate) plan.record = plan.decorate(plan.record)
    req.reply({ statusCode: 200, body: plan.record, delay })
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
  const names = (sel) => cy.get(sel).then(els => [...els].map(e => e.textContent))
  const editorStops = () => names('[data-testid="route-editor"] [data-testid="route-row"] .go__stop-text strong')
  const texts = (sel) => cy.get(sel).then(els => [...els].map(e => e.textContent))
  const menu = () => cy.get('[data-testid="route-menu"]').click()

  it('is open at load with the suggestion: stops, legs, what each adds, totals, and the map in route order', () => {
    let asked = 0
    open({ route: () => { asked += 1; return routed() } })
    cy.wait('@route').its('request.url').should('include', 'id=5').and('not.include', 'from=')
    cy.get('[data-testid="route-heading"]').should('have.text', 'Suggested route')
    cy.contains('Change anything and it becomes your group’s route.')
    cy.contains('button', 'Plan a route').should('not.exist')
    editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
    texts('[data-testid="route-editor"] .go__leg').should('deep.equal', ['↓ 42 min · 28 mi', '↓ 2 h 28 min · 84 mi'])
    cy.get('[data-testid="route-editor"] .go__covers').should('have.text', 'Covers 11 of 12 targets reported this week')
    cy.wrap(null).then(() => expect(asked).to.equal(1))
    // The route's map: its stops numbered in route order; the scouting map below keeps its place pins.
    cy.get('.event-route-panel__map .sightings-map').should('have.class', 'has-route')
    cy.get('.event-route-panel__map path.map-route').should('exist')
    cy.get('.event-route-panel__map .map-stop').then(els => expect([...els].map(e => e.textContent)).to.deep.equal(['1', '2', '3']))
    cy.get('[data-testid="scout-place"]').should('have.length', 3)
    cy.get('.event-scouting__map .map-pin').should('have.length', 3)
    // The whole route in Google Maps, behind ⋯.
    menu()
    cy.get('[data-testid="route-menu-items"] a[data-testid="route-link"]').should('have.text', 'Open whole route in Google Maps').invoke('attr', 'href').then(href => {
      const url = new URL(href)
      expect(url.searchParams.get('origin')).to.equal('31.9,-109.27')
      expect(url.searchParams.get('destination')).to.equal('31.87,-109.2')
      expect(url.searchParams.get('waypoints')).to.equal('31.88,-109.17')
    })
    cy.contains('[data-testid="route-menu-items"] button', 'Back to the suggested route').should('not.exist')
  })

  it('without drive times: a note, no legs, stops still in order', () => {
    open({ route: routed({ routed: false, total_min: null, total_mi: null, stops: routed().stops.map(s => ({ ...s, leg_min: null, leg_mi: null })) }) })
    cy.contains('[data-testid="route-unrouted"]', 'Drive times aren’t available right now')
    editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
    cy.get('.event-route-panel__map .map-stop').should('have.length', 3)
  })

  it('reads in kilometres outside the US', () => {
    open({ route: routed(), user: { ...TEST_USER, state: 'ON' } })
    texts('[data-testid="route-editor"] .go__leg').should('deep.equal', ['↓ 42 min · 45.1 km', '↓ 2 h 28 min · 135.2 km'])
  })

  it('a failed plan says so', () => {
    open({ route: { statusCode: 500, body: { error: 'boom' } } })
    cy.contains('[data-testid="event-route"]', 'Couldn’t plan a route right now. Try again in a bit.')
  })

  it('fits a phone without scrolling sideways', () => {
    cy.viewport(375, 740)
    const longName = (s) => ({ ...s, private: true, locName: `${s.locName} trailhead parking area and very long picnic ground name` })
    open({ route: routed({ stops: routed().stops.map(longName) }) })
    cy.get('[data-testid="route-editor"] .go__stop').should('have.length', 3)
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
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
    const twoStops = [{ locId: 'L400', name: 'Southwestern Research Station', lat: 31.87, lng: -109.2 }, { locId: 'L123', name: 'Cave Creek Canyon', lat: 31.88, lng: -109.17 }]
    const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString()
    const inView = () => cy.get('#route').should(el => {
      const r = el[0].getBoundingClientRect()
      expect(r.top).to.be.within(-5, 200)
    })

    it('#route (the scouting email\'s link) scrolls to the route', () => {
      cy.viewport(375, 667)
      open({ route: suggestion(), setup: stubDrive, path: '/events/5#route' })
      cy.wait('@plan')
      cy.wait('@route')
      editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      cy.window().its('scrollY').should('be.greaterThan', 0)
      inView()
    })

    it('#route jumps to the group’s saved route with reduced motion', () => {
      cy.viewport(375, 667)
      const server = { record: { start: { name: 'Portal Store', lat: 31.91, lng: -109.14 }, stops: twoStops, version: 3, updated_at: ago(130), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive, path: '/events/5#route', beforeLoad: (win) => {
        const real = win.matchMedia.bind(win)
        cy.stub(win, 'matchMedia').callsFake(q => (q.includes('prefers-reduced-motion') ? { matches: true, media: q, addEventListener () {}, removeEventListener () {}, addListener () {}, removeListener () {} } : real(q)))
        cy.spy(win.Element.prototype, 'scrollIntoView').as('scrollIntoView')
      } })
      cy.wait('@plan')
      cy.get('[data-testid="route-heading"]').should('have.text', 'Your group’s route · edited by Sam · 2 hours ago')
      editorStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      cy.get('@scrollIntoView').should('have.been.calledWithMatch', { behavior: 'auto' })
      cy.get('@scrollIntoView').should('not.have.been.calledWithMatch', { behavior: 'smooth' })
      inView()
    })

    it('a saved route shows instead of the suggestion, with who edited it, its meeting point and time', () => {
      const server = { record: { start: { name: 'Portal Store', lat: 31.91, lng: -109.14, time: '05:15' }, stops: twoStops, version: 3, updated_at: ago(130), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.wait('@plan').its('request.url').should('include', 'id=5')
      cy.wait('@drive')
      cy.get('[data-testid="route-heading"]').should('have.text', 'Your group’s route · edited by Sam · 2 hours ago')
      cy.contains('Change anything and it becomes').should('not.exist')
      editorStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      cy.get('[data-testid="start-card"]').should('contain', 'Meeting point').and('contain', 'Portal Store · 5:15 AM')
      cy.contains('[data-testid="start-card"] button', 'Change')
      cy.get('[data-testid="meeting-time"]').should('have.value', '05:15')
      cy.get('[data-testid="route-editor"] .go__covers').should('have.text', 'Covers 3 of 7 targets reported this week')
      cy.get('.event-route-panel__map .map-stop:not(.map-stop--start)').should('have.length', 2)
      cy.get('.event-route-panel__map .map-stop--start').should('have.length', 1)
      // The map's start is the same flag as the list's meeting point.
      cy.get('[data-testid="start-badge"] svg path').invoke('attr', 'd').then(d => cy.get('.event-route-panel__map .map-stop--start svg path').should('have.attr', 'd', d))
    })

    it('edits save to the group a moment after the last one: the first turns the suggestion into the group’s (version 0)', () => {
      const server = { record: { start: null, stops: null, version: 0 } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.wait('@plan')
      cy.get('[data-testid="start-card"]').should('contain', 'Meeting point').and('contain', 'Where does the day start?')
      editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      // Two quick edits, one save, straight from the list.
      cy.get('[aria-label="Move Rustler Park down"]').click()
      cy.get('[aria-label="Remove Southwestern Research Station"]').click()
      editorStops().should('deep.equal', ['Cave Creek Canyon', 'Rustler Park'])
      cy.contains('[data-testid="route-status"]', 'Saved')
      cy.get('@savePlan.all').should('have.length', 1)
      cy.get('@savePlan').its('request.body').should('deep.equal', {
        start: null, version: 0,
        stops: [{ locId: 'L123', name: 'Cave Creek Canyon', lat: 31.88, lng: -109.17, stay_min: null }, { locId: 'L200', name: 'Rustler Park', lat: 31.9, lng: -109.27, stay_min: null }]
      })
      cy.get('[data-testid="route-heading"]').should('contain', 'Your group’s route · edited by you')
      // "+ Add a stop" opens the places that would add birds, and the search.
      cy.get('[data-testid="add-stop"]').click()
      cy.contains('[data-testid="route-editor"] .place-search__results button', 'Paradise').should('contain', '+2 birds').click()
      editorStops().should('deep.equal', ['Cave Creek Canyon', 'Rustler Park', 'Paradise'])
      cy.contains('[data-testid="route-status"]', 'Saved')
      cy.get('@savePlan').its('request.body.version').should('equal', 1)
      cy.contains('[data-testid="start-card"] button', 'Set meeting point').click()
      cy.get('[data-testid="route-editor"] .go__start-picker input[type="search"]').type('31.9512, -109.3133')
      cy.contains('[data-testid="route-editor"] .go__start-picker button', 'Use 31.9512, -109.3133').click()
      cy.get('@savePlan.all').should('have.length', 3).its(2).its('request.body').should('deep.include', { start: { name: '31.9512, -109.3133', lat: 31.9512, lng: -109.3133, time: null }, version: 2 })
      // The meeting time, right under the meeting point.
      cy.contains('[data-testid="start-card"] button', 'Add time').click()
      cy.get('[data-testid="meeting-time"]').type('05:45')
      cy.get('@savePlan.all').should('have.length', 4).its(3).its('request.body.start').should('deep.include', { time: '05:45' })
    })

    it('someone else’s newer save wins: their route comes in and says who changed it', () => {
      const server = { record: { start: null, stops: twoStops, version: 4, updated_at: ago(5), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.wait('@plan')
      editorStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      // Meanwhile Sam saves version 5 with one stop.
      cy.wrap(null).then(() => { server.record = { start: null, stops: [twoStops[1]], version: 5, updated_at: ago(0), updated_by_name: 'Sam' } })
      cy.get('[aria-label="Remove Southwestern Research Station"]').click()
      cy.wait('@savePlan').its('response.statusCode').should('equal', 409)
      cy.contains('[data-testid="route-status"]', 'Sam just changed the route.')
      editorStops().should('deep.equal', ['Cave Creek Canyon'])
    })

    it('a server error keeps the edit on screen, saving, and it goes through once the server is back', () => {
      const server = { record: { start: null, stops: twoStops, version: 1 }, fail: 1 }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.wait('@plan')
      cy.get('[aria-label="Move Southwestern Research Station down"]').click()
      cy.wait('@savePlan').its('response.statusCode').should('equal', 500)
      editorStops().should('deep.equal', ['Cave Creek Canyon', 'Southwestern Research Station'])
      cy.contains('[data-testid="route-status"]', 'Saving…')
      cy.wait('@savePlan', { timeout: 15000 }).its('response.statusCode').should('equal', 200)
      cy.contains('[data-testid="route-status"]', 'Saved')
      cy.wrap(null).then(() => expect(server.record.stops.map(s => s.locId)).to.deep.equal(['L123', 'L400']))
    })

    it('back to the suggested route (behind ⋯) asks first, then clears it for everyone', () => {
      const server = { record: { start: null, stops: twoStops, version: 2, updated_at: ago(30), updated_by_name: 'Sam' } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.wait('@plan')
      menu()
      cy.contains('[data-testid="route-menu-items"] button', 'Back to the suggested route').click()
      cy.contains('[role="alert"]', 'Go back to the suggested route? This clears the route for everyone in the group.')
      cy.contains('[role="alert"] button', 'Cancel').click()
      cy.get('@deletePlan.all').should('have.length', 0)
      menu()
      cy.contains('[data-testid="route-menu-items"] button', 'Back to the suggested route').click()
      cy.contains('[role="alert"] button', 'Go back').click()
      cy.wait('@deletePlan').its('request.url').should('include', 'version=2')
      editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])
      cy.get('[data-testid="route-heading"]').should('have.text', 'Suggested route')
    })

    it('start from my location (behind ⋯) sets the meeting point', () => {
      const server = { record: { start: null, stops: twoStops, version: 1 } }
      open({ route: suggestion(), plan: server, setup: stubDrive, geo: (ok) => ok({ coords: { latitude: 31.95123, longitude: -109.31334 } }) })
      cy.wait('@plan')
      menu()
      cy.contains('[data-testid="route-menu-items"] button', 'Start from my location').click()
      cy.wait('@savePlan').its('request.body.start').should('deep.equal', { name: 'My location', lat: 31.9512, lng: -109.3133, time: null })
      cy.get('[data-testid="start-card"]').should('contain', 'My location')
    })

    it('offers a route made on this device before routes were shared, once', () => {
      const server = { record: { start: null, stops: null, version: 0 } }
      open({ route: suggestion(), plan: server, setup: stubDrive, stored: { start: null, stops: twoStops } })
      cy.contains('[role="alert"]', 'Save the route you made earlier for the group?').contains('button', 'Save').click()
      cy.wait('@savePlan').its('request.body').should('deep.equal', { start: null, stops: twoStops.map(s => ({ ...s, stay_min: null })), version: 0 })
      editorStops().should('deep.equal', ['Southwestern Research Station', 'Cave Creek Canyon'])
      cy.window().then(win => expect(win.localStorage.getItem(STORE_KEY)).to.equal(null))
      cy.contains('Save the route you made earlier').should('not.exist')
    })

    it('discarding the old route clears it; a group that has a route never sees the offer', () => {
      open({ route: suggestion(), plan: { record: { start: null, stops: null, version: 0 } }, setup: stubDrive, stored: { start: null, stops: twoStops } })
      cy.contains('[role="alert"]', 'Save the route you made earlier for the group?').contains('button', 'Discard').click()
      cy.contains('Save the route you made earlier').should('not.exist')
      cy.window().then(win => expect(win.localStorage.getItem(STORE_KEY)).to.equal(null))
      cy.get('@savePlan.all').should('have.length', 0)
      editorStops().should('deep.equal', ['Rustler Park', 'Cave Creek Canyon', 'Southwestern Research Station'])

      open({ route: suggestion(), plan: { record: { start: null, stops: [twoStops[0]], version: 1 } }, setup: stubDrive, stored: { start: null, stops: twoStops } })
      editorStops().should('deep.equal', ['Southwestern Research Station'])
      cy.contains('Save the route you made earlier').should('not.exist')
      cy.window().then(win => expect(win.localStorage.getItem(STORE_KEY)).to.equal(null))
    })

    it('says when some reports couldn’t be loaded', () => {
      open({ route: suggestion({ incomplete: true }), plan: { record: { start: null, stops: null, version: 0 } } })
      cy.contains('.event-route__note', 'Some reports couldn’t be loaded, so this may change on refresh.')
    })

    it('tapping a row lights its pin on the map, and a pin lights its row', () => {
      const server = { record: { start: null, stops: twoStops, version: 1 } }
      open({ route: suggestion(), plan: server, setup: stubDrive })
      cy.wait('@plan')
      cy.get('[data-testid="route-editor"] [data-testid="route-row"]').eq(1).find('.go__stop-main').click()
      cy.get('[data-testid="route-editor"] [data-testid="route-row"]').eq(1).should('have.class', 'is-active')
      cy.get('.event-route-panel__map .map-stop--active').should('have.text', '2')
      cy.contains('.event-route-panel__map .map-stop', /^1$/).click({ force: true })
      cy.get('[data-testid="route-editor"] [data-testid="route-row"]').eq(0).should('have.class', 'is-active')
      cy.get('[data-testid="route-editor"] [data-testid="route-row"]').eq(1).should('not.have.class', 'is-active')
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
      const stepper = (i) => cy.get('[data-testid="route-editor"] [data-testid="stop-stay"]').eq(i)
      const noDrive = () => cy.intercept('GET', '**/api/ebird/drive*', { statusCode: 500, body: { error: 'down' } }).as('drive')

      it('the suggestion shows each stop’s suggested stay and the whole day', () => {
        open({ route: timed(), setup: stubDrive })
        cy.wait('@plan')
        texts('[data-testid="route-editor"] .go__stay-value').should('deep.equal', ['45 min', '30 min', '20 min'])
        cy.get('[data-testid="route-editor"] .go__stay-tag').should('have.length', 3)
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 3 h 10 min · At stops 1 h 35 min · Total 4 h 45 min')
        cy.get('[data-testid="route-totals"] strong').should('have.text', 'Total 4 h 45 min')
      })

      it('a saved route: the group’s stays, the drive into each stop, and totals', () => {
        open({ route: timed(), plan: savedPlan([60, null]), setup: stubDrive })
        cy.wait('@plan')
        cy.wait('@drive')
        texts('[data-testid="route-editor"] .go__stay-value').should('deep.equal', ['1 h', '40 min'])
        texts('[data-testid="route-editor"] .go__leg').should('deep.equal', ['↓ 10 min · 5 mi'])
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 40 min · Total 1 h 50 min')
      })

      it('when /ebird/drive can’t answer, the saved legs and drive total stand, in the viewer’s unit', () => {
        const plan = savedPlan([null, null], { start: { name: 'Portal Store', lat: 31.91, lng: -109.14 } })
        open({ route: timed(), plan, user: { ...TEST_USER, state: 'ON' }, setup: noDrive })
        cy.wait('@plan')
        texts('[data-testid="route-editor"] .go__leg').should('deep.equal', ['↓ 24 min · 19.3 km', '↓ 24 min · 19.3 km'])
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 48 min · At stops 1 h 5 min · Total 1 h 53 min')
        cy.get('[data-testid="route-unrouted"]').should('not.exist')
      })

      it('routed: false: no drive total, the stops’ time still adds up', () => {
        const plan = savedPlan([null, 15])
        plan.record = { ...plan.record, legs: [null, null], totals: { drive_min: null, stay_min: 40, total_min: 40 }, routed: false }
        open({ route: timed(), plan, setup: noDrive })
        cy.wait('@plan')
        cy.get('[data-testid="route-editor"] .go__stop').should('have.length', 2)
        cy.contains('[data-testid="route-unrouted"]', 'Drive times aren’t available right now.')
        cy.get('[data-testid="route-totals"]').should('have.text', 'At stops 40 min')
      })

      it('the stepper: −/+ in fives, a typed time, use suggested; totals move at once and each change saves with its version', () => {
        const plan = savedPlan()
        open({ route: timed(), plan, setup: stubDrive })
        cy.wait('@plan')
        stepper(1).within(() => {
          cy.get('.go__stay-value').should('have.text', '40 min')
          cy.contains('.go__stay-tag', 'suggested')
          cy.contains('button', 'use suggested').should('not.exist')
        })
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 5 min · Total 1 h 15 min')

        cy.get('[aria-label="More time at Cave Creek Canyon"]').click()
        // On screen before the save goes.
        stepper(1).find('.go__stay-value').should('have.text', '45 min')
        stepper(1).find('.go__stay-tag').should('not.be.visible')
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 10 min · Total 1 h 20 min')
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
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 1 h 45 min · Total 1 h 55 min')
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
        cy.get('[data-testid="route-totals"]').should('have.text', 'Driving 10 min · At stops 8 h 40 min · Total 8 h 50 min')
      })

      // − and + stay put whatever the time reads, and while typing it.
      const buttonsStayPut = () => {
        const less = '[aria-label="Less time at Southwestern Research Station"]'
        const more = '[aria-label="More time at Southwestern Research Station"]'
        const xs = () => cy.get(less).then(l => cy.get(more).then(m => [l[0].getBoundingClientRect().x, m[0].getBoundingClientRect().x]))
        const same = (start) => xs().should(([l, m]) => {
          expect(Math.abs(l - start[0]), '− moved').to.be.at.most(0.5)
          expect(Math.abs(m - start[1]), '+ moved').to.be.at.most(0.5)
        })
        const typeIn = (minutes) => {
          stepper(0).find('.go__stay-value').click()
          cy.get('[aria-label="Minutes at Southwestern Research Station"]').clear()
          cy.get('[aria-label="Minutes at Southwestern Research Station"]').type(`${minutes}{enter}`)
        }
        open({ route: timed(), plan: savedPlan([0, null]), setup: stubDrive })
        stepper(0).find('.go__stay-value').should('have.text', '0 min')
        xs().then((start) => {
          cy.get(more).click()
          stepper(0).find('.go__stay-value').should('have.text', '5 min')
          same(start)
          ;[[45, '45 min'], [60, '1 h'], [95, '1 h 35 min'], [480, '8 h'], [475, '7 h 55 min']].forEach(([minutes, text]) => {
            typeIn(minutes)
            stepper(0).find('.go__stay-value').should('have.text', text)
            same(start)
          })
          stepper(0).find('.go__stay-value').click()
          cy.get('[aria-label="Minutes at Southwestern Research Station"]').should('be.focused')
          same(start)
          cy.get('[aria-label="Minutes at Southwestern Research Station"]').type('{esc}')
          stepper(0).contains('button', 'use suggested').click()
          stepper(0).find('.go__stay-value').should('have.text', '25 min')
          same(start)
        })
      }

      it('− and + never move as the time changes or while typing it', buttonsStayPut)

      it('− and + never move on a phone either', () => {
        cy.viewport(375, 740)
        buttonsStayPut()
        cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
      })

      // Saving…, Saved, a server error that's retried and someone else's change all come and go
      // while the stays are tapped; no stepper button moves, across or down.
      const nothingMovesWhileSaving = () => {
        const plan = { ...savedPlan(), delay: 600 }
        const buttons = '[data-testid="route-editor"] .go__stay-step'
        // Measured on the page, not the window: Cypress scrolls a button into view to tap it.
        const at = () => cy.get(buttons).then(els => [...els].map(el => {
          const r = el.getBoundingClientRect()
          const win = el.ownerDocument.defaultView
          return [r.x + win.scrollX, r.y + win.scrollY]
        }))
        const still = (start) => at().should((now) => {
          expect(now).to.have.length(start.length)
          now.forEach(([x, y], i) => {
            expect(Math.abs(x - start[i][0]), `button ${i} x`).to.be.at.most(0.5)
            expect(Math.abs(y - start[i][1]), `button ${i} y`).to.be.at.most(0.5)
          })
        })
        const status = () => cy.get('[data-testid="route-status"]')
        open({ route: timed(), plan, setup: stubDrive })
        cy.wait('@plan')
        cy.get(buttons).should('have.length', 4)
        stepper(1).find('.go__stay-value').should('have.text', '40 min')
        status().should('have.class', 'is-empty')
        at().then((start) => {
          ;[['More', 'Cave Creek Canyon', '45 min', 1], ['More', 'Southwestern Research Station', '30 min', 0], ['Less', 'Cave Creek Canyon', '40 min', 1]].forEach(([which, name, text, i]) => {
            cy.get(`[aria-label="${which} time at ${name}"]`).click()
            still(start)
            stepper(i).find('.go__stay-value').should('have.text', text)
            status().should('contain', 'Saving…')
            still(start)
            cy.wait('@savePlan')
            status().should('contain', 'Saved')
            still(start)
          })
          // A server error: still saving while it's tried again, then saved.
          cy.wrap(null).then(() => { plan.fail = 1 })
          cy.get('[aria-label="Less time at Southwestern Research Station"]').click()
          cy.wait('@savePlan').its('response.statusCode').should('equal', 500)
          status().should('contain', 'Saving…')
          still(start)
          status().should('contain', 'Saved', { timeout: 15000 })
          still(start)
          // Someone else saved meanwhile: their route (the same stops) comes in, with a line saying so.
          cy.wrap(null).then(() => { plan.record = decorate({ ...plan.record, version: plan.record.version + 1, updated_by_name: 'Sam', updated_by_you: false }) })
          cy.get('[aria-label="More time at Cave Creek Canyon"]').click()
          cy.contains('[data-testid="route-status"]', 'Sam just changed the route.')
          still(start)
          cy.get('[aria-label="More time at Cave Creek Canyon"]').click()
          still(start)
          status().should('contain', 'Saved')
          still(start)
        })
      }

      it('nothing moves while edits save, retry or meet someone else’s', nothingMovesWhileSaving)

      it('nothing moves while edits save, on a phone too', () => {
        cy.viewport(375, 740)
        nothingMovesWhileSaving()
        cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
      })
    })

    it('the route fits a phone without scrolling sideways', () => {
      cy.viewport(375, 740)
      open({ route: suggestion(), plan: { record: { start: { name: 'A very long meeting point name at the trailhead parking area', lat: 31.9, lng: -109.2 }, stops: twoStops, version: 1, updated_by_name: null, updated_at: ago(3000) } }, setup: stubDrive })
      cy.get('[data-testid="route-heading"]').should('have.text', 'Your group’s route · edited by a group member · 2 days ago')
      cy.get('[data-testid="route-editor"] .go__stop').should('have.length', 2)
      cy.get('[data-testid="route-editor"] [data-testid="stop-stay"]').should('have.length', 2)
      cy.get('[data-testid="route-menu"]').click()
      cy.get('[data-testid="add-stop"]').click()
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
})
