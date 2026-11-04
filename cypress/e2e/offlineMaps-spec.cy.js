import { stubAuth } from '../support/stubs'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

// Two days out: the event page shows "Get ready for offline".
const event = {
  id: 5, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30, home_lat: 31.5, home_lng: -110,
  starts_on: day(2), ends_on: day(2), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(-19), active: false,
  role: 'organizer', members: [{ display_name: 'Matt', role: 'organizer', you: true }],
  targets: [{ code: 'eletro' }], tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456'
}

const routed = {
  from: null,
  stops: [
    { n: 1, locId: 'L200', locName: 'Rustler Park', lat: 31.9, lng: -109.27, new_birds: [], leg_min: null, leg_mi: null },
    { n: 2, locId: 'L123', locName: 'Cave Creek Canyon', lat: 31.88, lng: -109.17, new_birds: [], leg_min: 42, leg_mi: 28 },
    { n: 3, locId: 'L400', locName: 'Southwestern Research Station', lat: 31.87, lng: -109.2, new_birds: [], leg_min: 20, leg_mi: 9 }
  ],
  total_min: 62, total_mi: 37, covered: 1, reported: 1, skipped: 0, geometry: [], routed: true
}

// The meeting point and the three stops, with a margin: centred here, zoomed to fit a phone.
const CENTRE = 'center=31.91,-109.235&zoom=11'
const APPLE_CENTRE = 'll=31.91,-109.235&z=11'

const open = ({ ua = null, touch = 0, width = 1280, store = {} } = {}) => {
  cy.viewport(width, width < 600 ? 812 : 900)
  stubAuth({ loggedIn: true })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: { checked_at: new Date().toISOString(), days_to_go: 2, using: 'targets', reported: [], unreported: [] } })
  cy.intercept('GET', '**/api/saved?kind=event-route*', { statusCode: 200, body: routed })
  cy.intercept('GET', '**/api/saved?kind=event-route-plan*', { statusCode: 200, body: { start: { name: 'Portal', lat: 31.95, lng: -109.3, time: '05:30' }, stops: null, version: 1 } })
  cy.intercept('GET', '**/api/saved?kind=event-log*', { statusCode: 200, body: { entries: [] } })
  cy.visit('/events/5', { onBeforeLoad: (win) => {
    if (ua) Object.defineProperty(win.navigator, 'userAgent', { value: ua })
    Object.defineProperty(win.navigator, 'maxTouchPoints', { value: touch })
    for (const [key, value] of Object.entries(store)) win.localStorage.setItem(key, value)
  } })
  cy.get('[data-testid="offline-maps"]').should('exist')
}

describe('Offline maps in Get ready', () => {
  it('an iPhone opens Apple Maps on the route, with Google one tap away; the choice is remembered', () => {
    open({ ua: IPHONE, touch: 5 })
    cy.get('[data-testid="maps-open-apple"]').should('have.class', 'pill-button--primary').and('have.text', 'Open in Apple Maps')
      .and('have.attr', 'href', `https://maps.apple.com/?${APPLE_CENTRE}`).and('have.attr', 'target', '_blank')
    cy.get('[data-testid="maps-open-google"]').should('not.exist')
    cy.get('[data-testid="maps-steps"] li').then(els => [...els].map(e => e.textContent)).should('deep.equal', [
      'Tap your picture → Offline Maps → Add.',
      'Fit the box to the area, then tap Download.',
      'Or search Cochise County, tap it, then tap Download.'
    ])
    cy.contains('[data-testid="maps-switch"]', 'Use Google Maps instead').click()
    cy.get('[data-testid="maps-open-google"]').should('have.class', 'pill-button--primary').and('have.text', 'Open in Google Maps')
      .and('have.attr', 'href', `https://www.google.com/maps/@?api=1&map_action=map&${CENTRE}`)
    cy.get('[data-testid="maps-open-apple"]').should('not.exist')
    cy.get('[data-testid="maps-steps"]').should('contain', 'Tap your profile picture → Offline maps → Select your own map.').and('not.contain', 'Add.')
    cy.contains('[data-testid="maps-switch"]', 'Use Apple Maps instead')
    cy.window().then(win => expect(win.localStorage.getItem('bird-alert:maps-app')).to.equal('google'))
    // Back another day: still Google.
    open({ ua: IPHONE, touch: 5 })
    cy.get('[data-testid="maps-open-google"]').should('have.class', 'pill-button--primary')
    cy.get('[data-testid="maps-open-apple"]').should('not.exist')
  })

  it('an iPad asking as a Mac counts as an iPhone', () => {
    open({ ua: IPAD_AS_MAC, touch: 5 })
    cy.get('[data-testid="maps-open-apple"]').should('have.class', 'pill-button--primary')
    cy.get('[data-testid="maps-switch"]').should('contain', 'Use Google Maps instead')
  })

  it('Android has Google Maps only, even with Apple remembered', () => {
    open({ ua: ANDROID, touch: 5, store: { 'bird-alert:maps-app': 'apple' } })
    cy.get('[data-testid="maps-open-google"]').should('have.class', 'pill-button--primary')
      .and('have.attr', 'href', `https://www.google.com/maps/@?api=1&map_action=map&${CENTRE}`)
    cy.get('[data-testid="maps-open-apple"]').should('not.exist')
    cy.get('[data-testid="maps-switch"]').should('not.exist')
    cy.get('[data-testid="maps-steps"]').should('contain', 'Select your own map')
  })

  it('a computer shows both, says the map is saved on the phone, and the steps follow the one picked', () => {
    open()
    cy.get('[data-testid="maps-open-google"]').should('have.class', 'pill-button--primary').and('have.attr', 'href').and('include', CENTRE)
    cy.get('[data-testid="maps-open-apple"]').should('not.have.class', 'pill-button--primary').and('have.attr', 'href').and('include', APPLE_CENTRE)
    cy.get('[data-testid="offline-maps"]').should('contain', 'Offline maps are saved on your phone')
    cy.get('[data-testid="maps-steps"]').should('contain', 'Select your own map')
    // Opening Apple's (in a new tab) picks it: its steps show.
    cy.get('[data-testid="maps-open-apple"]').then(a => a.removeAttr('target').attr('href', '#')).click()
    cy.get('[data-testid="maps-open-apple"]').should('have.class', 'pill-button--primary')
    cy.get('[data-testid="maps-steps"]').should('contain', 'Offline Maps → Add.')
  })

  it('"I’ve downloaded the map" shows in the status line, for this event, after a reload', () => {
    open({ ua: IPHONE, touch: 5 })
    cy.get('[data-testid="ready-map"]').should('not.exist')
    cy.contains('label', 'I’ve downloaded the map').click()
    cy.get('[data-testid="ready-status"] [data-testid="ready-map"]').should('have.text', ' · ✓ Map downloaded')
    cy.window().then(win => expect(win.localStorage.getItem('bird-alert:event-map-saved:5')).to.equal('1'))
    open({ ua: IPHONE, touch: 5 })
    cy.get('[data-testid="map-downloaded"]').should('be.checked')
    cy.get('[data-testid="ready-map"]').should('contain', '✓ Map downloaded')
    cy.get('[data-testid="map-downloaded"]').uncheck()
    cy.get('[data-testid="ready-map"]').should('not.exist')
  })

  it('no sideways scroll at 375px', () => {
    open({ ua: IPHONE, touch: 5, width: 375 })
    cy.get('[data-testid="maps-open-apple"]').should('be.visible')
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
    cy.get('[data-testid="offline-maps"]').then(el => expect(el[0].getBoundingClientRect().right).to.be.at.most(375))
  })
})
