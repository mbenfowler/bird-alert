import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const event = (over = {}) => ({
  id: 5, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30,
  starts_on: day(30), ends_on: day(30), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(9), active: false,
  role: 'organizer',
  members: [{ display_name: 'Jane', role: 'member' }, { display_name: 'Matt', role: 'organizer', you: true }, { display_name: 'Sam', role: 'member' }],
  targets: [{ code: 'eletro', lifer_for: ['Jane', 'Sam'] }, { code: 'mexchi' }],
  tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456',
  ...over
})

const stubBirds = () => cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [
  { speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: null },
  { speciesCode: 'mexchi', comName: 'Mexican Chickadee', sciName: 'Poecile sclateri', birdImg: null }
] }).as('birds')

const stubRegions = () => cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }, { code: 'US-GA-139', name: 'Hall' }] })

// The share sheet only appears on touch screens; elsewhere the link is copied.
const copied = (win) => cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves()

describe('Group events', () => {
  it('shares a trip with the group, asking only for a name, and lists the event', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    const place = { id: 7, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30, home_lat: null, home_lng: null, targets: [], trips: [{ id: 3, starts_on: day(30), ends_on: day(30), active: false, kind: 'bigday', scout: true, scout_days: 21 }] }
    cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [place] }).as('places')
    cy.intercept('POST', '**/api/saved?kind=event-from-trip', { statusCode: 201, body: event() }).as('share')
    cy.visit('http://localhost:3000/settings?tab=places')
    cy.contains('button', 'Share with my group').click()
    cy.get('.event-share input[name="display_name"]').should('have.value', '')
    cy.contains('.event-share button', 'Share it').click()
    cy.contains('.event-share', 'Add the name your group knows you by.')
    cy.get('.event-share input[name="display_name"]').type('Matt')
    cy.get('.place__trips li').should('have.length', 1)
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event()] }).as('events')
    // The server moves the trip into the event; the place's trip line goes at once, no reload.
    cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [{ ...place, trips: [] }] }).as('placesAfter')
    cy.contains('.event-share button', 'Share it').click()
    cy.wait('@share').its('request.body').should('deep.equal', { trip_id: 3, display_name: 'Matt' })
    cy.wait('@placesAfter')
    cy.get('.place__trips').should('not.exist')
    cy.contains('.notification__hint', 'No trip dates yet.')
    cy.get('.events [data-event="5"]').should('contain', 'Chiricahuas').and('contain', 'Big Day')
    cy.get('.events .event__members').should('have.text', 'Matt (organizer), Jane, Sam')
    cy.get('.events .event__target').first().should('contain', 'Elegant Trogon').and('contain', 'lifer for Jane, Sam')
  })

  it('invites by link; the organizer can make a new link and end the event, a member can only leave', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event()] }).as('events')
    cy.intercept('POST', '**/api/saved?kind=event-invite-rotate*', { statusCode: 200, body: event({ invite_url: '/events/join/new789' }) }).as('rotate')
    cy.intercept('DELETE', '**/api/saved?kind=event&id=5', { statusCode: 204, body: '' }).as('end')
    cy.visit('http://localhost:3000/settings?tab=places', { onBeforeLoad: copied })
    cy.contains('.events button', 'Invite').click()
    cy.get('@copy').should('have.been.calledWith', 'http://localhost:3000/events/join/inv123')
    cy.contains('.events button', 'View-only link').click()
    cy.get('@copy').should('have.been.calledWith', 'http://localhost:3000/events/view/view456')
    cy.contains('.events', "For people who don't want an account")
    cy.contains('.events button', 'Make a new invite link').click()
    cy.wait('@rotate')
    cy.contains('.events button', 'End event').click()
    cy.contains('.events', 'End Chiricahuas for everyone?')
    cy.contains('.events button', 'Yes').click()
    cy.wait('@end')
  })

  it('a member sees Leave, not the organizer controls', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event({ role: 'member' })] })
    cy.intercept('POST', '**/api/saved?kind=event-leave*', { statusCode: 204, body: '' }).as('leave')
    // Scouting reports and event emails link to /events: the Places tab's group events.
    cy.visit('http://localhost:3000/events')
    cy.url().should('include', '/settings?tab=places')
    cy.get('#events').should('contain', 'Chiricahuas')
    cy.contains('.events button', 'Make a new invite link').should('not.exist')
    cy.contains('.events button', 'End event').should('not.exist')
    cy.contains('.events button', 'Leave').click()
    cy.contains('.events button', 'Yes').click()
    cy.wait('@leave')
  })

  it('an invite opened logged out is remembered through signing in, then joins with a name', () => {
    const state = stubAuth({ loggedIn: false })
    cy.intercept('GET', '**/api/saved?kind=event-preview*', { statusCode: 200, body: { name: 'Chiricahuas', area: 'Cochise County, Arizona', starts_on: '2027-05-09', ends_on: '2027-05-09', kind: 'bigday', members: 3 } }).as('preview')
    cy.intercept('POST', '**/api/saved?kind=event-join', { statusCode: 200, body: event({ role: 'member' }) }).as('join')
    cy.visit('http://localhost:3000/events/join/inv123')
    cy.contains('h1', 'Join Chiricahuas')
    cy.contains('.event-page', 'Cochise County, Arizona').and('contain', 'Big Day').and('contain', '3 birders so far')
    cy.contains('.event-page a', 'Log in or sign up').should('have.attr', 'href', '/login')
    cy.window().then((win) => expect(JSON.parse(win.localStorage.getItem('bird-alert:join')).token).to.eq('inv123'))
    // Signing in (any way) brings them back to the invite.
    cy.then(() => { state.loggedIn = true })
    cy.visit('http://localhost:3000/')
    cy.url().should('include', '/events/join/inv123')
    cy.get('.event-page__join input[name="display_name"]').type('Jane')
    cy.contains('.event-page__join button', 'Join').click()
    cy.wait('@join').its('request.body').should('deep.equal', { token: 'inv123', display_name: 'Jane' })
    cy.url().should('include', '/settings?tab=places')
    cy.window().then((win) => expect(win.localStorage.getItem('bird-alert:join')).to.eq(null))
  })

  it('the view-only page is public, shows no names, and refreshes the tally on the day', () => {
    stubAuth({ loggedIn: false })
    let calls = 0
    cy.intercept('GET', '**/api/saved?kind=event-view*', (req) => {
      calls += 1
      req.reply({ statusCode: 200, body: { name: 'Chiricahuas', area: 'Cochise County, Arizona', starts_on: day(0), ends_on: day(0), kind: 'bigday', active: true,
        targets: [{ code: 'eletro', speciesCode: 'eletro', comName: 'Elegant Trogon' }],
        tally: calls === 1 ? [{ code: 'eletro', comName: 'Elegant Trogon', added_at: '2027-05-09T12:00:00Z' }] : [{ code: 'eletro', comName: 'Elegant Trogon', added_at: '2027-05-09T12:00:00Z' }, { code: 'mexchi', comName: 'Mexican Chickadee', added_at: '2027-05-09T13:00:00Z' }],
        count: calls === 1 ? 1 : 2 } })
    }).as('view')
    cy.clock(Date.now(), ['setInterval'])
    cy.visit('http://localhost:3000/events/view/view456')
    cy.wait('@view')
    cy.get('[data-testid="view-count"]').should('have.text', '1 species so far')
    cy.contains('.event-page', 'Bird Alert keeps your group')
    cy.get('.event-page').should('not.contain', 'Matt').and('not.contain', 'Jane')
    cy.url().should('include', '/events/view/view456')
    cy.tick(61_000)
    cy.wait('@view')
    cy.get('[data-testid="view-count"]').should('have.text', '2 species so far')
  })

  it('on the day, the home banner opens the tally; adding and undoing update the count against targets', () => {
    const user = { ...TEST_USER, activeEvent: { id: 5, name: 'Chiricahuas', count: 0 } }
    stubAuth({ loggedIn: true, user })
    stubRegions()
    stubBirds()
    let tally = []
    cy.intercept('GET', '**/api/saved?kind=events*', (req) => req.reply({ statusCode: 200, body: [event({ active: true, starts_on: day(0), ends_on: day(0), tally })] })).as('events')
    cy.intercept('POST', '**/api/saved?kind=event-tally*', (req) => {
      tally = [{ code: req.body.species_code, added_by_name: 'Matt', added_at: new Date().toISOString() }, ...tally]
      req.reply({ statusCode: 200, body: event({ tally }) })
    }).as('add')
    cy.intercept('DELETE', '**/api/saved?kind=event-tally*', (req) => {
      const code = new URL(req.url).searchParams.get('code')
      tally = tally.filter(entry => entry.code !== code)
      req.reply({ statusCode: 204, body: '' })
    }).as('remove')
    cy.visit('http://localhost:3000/')
    cy.get('[data-testid="event-banner"]').should('contain', 'Big Day today: Chiricahuas').and('contain', '0 species')
    cy.contains('[data-testid="event-banner"] a', 'Open tally').click()
    cy.url().should('include', '/events/5/tally')
    cy.get('[data-testid="tally-count"]').should('contain', '0 species').and('contain', '0 of 2 targets')
    cy.contains('.event-page__section button', 'Elegant Trogon').click()
    cy.wait('@add').its('request.body').should('deep.equal', { species_code: 'eletro' })
    cy.get('[data-testid="tally-count"]').should('contain', '1 species').and('contain', '1 of 2 targets')
    cy.get('.event-tally__list li').first().should('contain', 'Elegant Trogon').and('contain', 'Matt')
    cy.get('button[aria-label="Take Elegant Trogon off the tally"]').click()
    cy.wait('@remove').its('request.url').should('include', 'code=eletro')
    cy.get('[data-testid="tally-count"]').should('contain', '0 species')
  })

  it('a bird new to the person who adds it is offered for their life list; one already on it says nothing', () => {
    const user = { ...TEST_USER, activeEvent: { id: 5, name: 'Chiricahuas', count: 0 } }
    stubAuth({ loggedIn: true, user })
    stubRegions()
    stubBirds()
    // Mexican Chickadee is already on the life list; Elegant Trogon isn't.
    cy.intercept('GET', '**/api/saved?kind=seen*', { statusCode: 200, body: [{ speciesCode: 'mexchi', firstSeen: '2024-05-01', source: 'tap' }] }).as('seen')
    cy.intercept('POST', '**/api/saved?kind=seen*', { statusCode: 201, body: { speciesCode: 'eletro' } }).as('markSeen')
    let tally = []
    cy.intercept('GET', '**/api/saved?kind=events*', (req) => req.reply({ statusCode: 200, body: [event({ active: true, starts_on: day(0), ends_on: day(0), tally })] }))
    cy.intercept('POST', '**/api/saved?kind=event-tally*', (req) => {
      tally = [{ code: req.body.species_code, added_by_name: 'Matt', added_at: new Date().toISOString() }, ...tally]
      req.reply({ statusCode: 200, body: event({ tally }) })
    }).as('add')
    cy.visit('http://localhost:3000/events/5/tally')
    cy.wait('@seen')
    cy.get('.event-tally__add input').should('have.attr', 'placeholder', 'Add a bird…')
    cy.contains('.event-page__section button', 'Mexican Chickadee').click()
    cy.wait('@add')
    cy.get('[data-testid="lifer-prompt"]').should('not.exist')
    cy.contains('.event-page__section button', 'Elegant Trogon').click()
    cy.wait('@add')
    cy.get('[data-testid="lifer-prompt"]').should('contain', 'Lifer!').and('contain', 'Add Elegant Trogon to your life list?')
    cy.contains('[data-testid="lifer-prompt"] button', 'Add to my life list').click()
    cy.wait('@markSeen').its('request.body').should('deep.equal', { speciesCode: 'eletro' })
    cy.get('[data-testid="lifer-prompt"]').should('not.exist')
  })
})
