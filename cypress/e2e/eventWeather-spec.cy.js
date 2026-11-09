import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const COCHISE = 'US-AZ-003'
const pad = (n) => String(n).padStart(2, '0')
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const event = (over = {}) => ({
  id: 5, name: 'Cochise Big Day', state: 'AZ', location: COCHISE, range_mi: 30, timezone: 'America/Phoenix',
  starts_on: day(1), ends_on: day(1), kind: 'bigday', scout: false, active: false,
  role: 'organizer', display_name: null, home_lat: 31.55, home_lng: -110.28,
  members: [{ display_name: null, role: 'organizer', you: true }],
  targets: [], tally: [], invite_url: null, view_url: null,
  ...over
})

const PLAN = {
  start: { name: 'Sierra Vista Park & Ride', lat: 31.5455, lng: -110.2773, time: '05:30' },
  stops: [
    { locId: 'L1', name: 'Ramsey Canyon', lat: 31.4473, lng: -110.3075, stay_min: 90 },
    { locId: 'L2', name: 'Cave Creek Canyon', lat: 31.8834, lng: -109.2064, stay_min: 120 }
  ],
  legs: [{ min: 30, mi: 12 }, { min: 110, mi: 90 }],
  version: 3, position: null
}

// Per place, in the order asked: clear and 5 °C at the meeting point, rain and 10 °C at Ramsey,
// cloudy with 50 km/h gusts and 15 °C at Cave Creek.
const SKIES = [
  { code: 0, temp: 5, rain: 0, wind: 5, gust: 10 },
  { code: 61, temp: 10, rain: 60, wind: 12, gust: 20 },
  { code: 3, temp: 15, rain: 0, wind: 25, gust: 50 }
]
const forecast = (req) => {
  const params = new URL(req.url).searchParams
  const lats = params.get('latitude').split(',')
  const time = [params.get('start_date'), params.get('end_date')].flatMap(d => Array.from({ length: 24 }, (_, h) => `${d}T${pad(h)}:00`))
  const one = (i) => {
    const sky = SKIES[i]
    const all = (v) => time.map(() => v)
    return { latitude: Number(lats[i]), hourly: { time, temperature_2m: all(sky.temp), precipitation_probability: all(sky.rain), weather_code: all(sky.code), wind_speed_10m: all(sky.wind), wind_gusts_10m: all(sky.gust), is_day: all(1) } }
  }
  req.reply({ statusCode: 200, body: lats.length === 1 ? one(0) : lats.map((_, i) => one(i)) })
}

const open = (weather = forecast) => {
  stubAuth({ loggedIn: true, user: { ...TEST_USER, state: 'AZ' } })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=event-route*', { statusCode: 200, body: { from: null, stops: [], extras: [], total_min: null, total_mi: null, covered: 0, reported: 0, skipped: 0, geometry: [], routed: false } })
  cy.intercept('GET', '**/api/saved?kind=event-route-plan*', { statusCode: 200, body: PLAN })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event()] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: null })
  cy.intercept('GET', '**/api/saved?kind=event-log*', { statusCode: 200, body: [] })
  cy.intercept('GET', 'https://api.open-meteo.com/v1/forecast*', weather).as('weather')
  cy.visit('/events/5')
}

describe('The day: sun tiles and the forecast at each stop', () => {
  it('shows the sun as tiles and each stop’s weather at its planned time, from one request', () => {
    open()
    cy.wait('@weather').then(({ request }) => {
      const params = new URL(request.url).searchParams
      expect(params.get('latitude')).to.equal('31.5455,31.4473,31.8834')
      expect(params.get('longitude')).to.equal('-110.2773,-110.3075,-109.2064')
      expect(params.get('start_date')).to.equal(day(1))
      expect([...params.keys()].sort()).to.deep.equal(['end_date', 'hourly', 'latitude', 'longitude', 'start_date', 'timezone'])
    })
    cy.get('[data-testid="sun-times"]').first().within(() => {
      cy.get('.event-day__sun-tile').should('have.length', 6)
      cy.get('[data-testid="sun-sunrise"]').should('contain', 'Sunrise').find('svg').should('exist')
      cy.get('[data-testid="sun-nauticalDawn"]').should('contain', 'Nautical dawn').and('contain', '🦉')
      cy.get('[data-testid="sun-sunset"] .event-day__sun-time').invoke('text').should('match', /\d:\d\d/)
    })
    cy.get('[data-testid="start-weather"]').should('contain', 'Forecast at Sierra Vista Park & Ride, 5:30 AM').and('contain', 'Clear, 41°F, wind 3 mph')
    cy.get('[data-testid="day-stop"]').eq(0).find('[data-testid="stop-weather"]').should('contain', '50°F · wind 7 mph · 60% rain').find('svg[data-kind="rain"]').should('exist')
    cy.get('[data-testid="day-stop"]').eq(1).find('[data-testid="stop-weather"]').should('contain', '59°F · wind 16 mph · gusts 31 mph').find('svg[data-kind="wind"]').should('exist')
    cy.get('[data-testid="weather-credit"]').should('contain', 'Open-Meteo')
    cy.get('@weather.all').should('have.length', 1)
  })

  it('leaves the weather off when the forecast fails, the sun still there', () => {
    open({ statusCode: 500, body: { error: 'down' } })
    cy.wait('@weather')
    cy.get('[data-testid="sun-times"] .event-day__sun-tile').should('have.length.at.least', 6)
    cy.get('[data-testid="day-stop"]').should('have.length', 2)
    cy.get('[data-testid="stop-weather"]').should('not.exist')
    cy.get('[data-testid="start-weather"]').should('not.exist')
    cy.get('[data-testid="weather-credit"]').should('not.exist')
  })

  if (Cypress.env('WEATHER_SHOT')) {
    it('looks right on a phone', () => {
      cy.viewport(390, 844)
      open()
      cy.get('[data-testid="stop-weather"]').should('have.length', 2)
      cy.get('.event-detail__plan').scrollIntoView({ offset: { top: -60, left: 0 } })
      cy.screenshot('weather', { capture: 'viewport', overwrite: true })
      cy.get('[data-testid="day-stops"]').screenshot('weather-stops', { overwrite: true })
    })
  }
})
