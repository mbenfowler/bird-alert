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

// A solo event's only member: you, with no group name yet.
const solo = { display_name: null, role: 'organizer', you: true }

// The share sheet only appears on touch screens; elsewhere the link is copied.
const copied = (win) => cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves()

describe('Events', () => {
  it('the top bar opens Events: upcoming with today first, past with a recap, archived when asked', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [
      event({ id: 6, name: 'Patagonia', kind: 'trip', starts_on: day(3), ends_on: day(5), scout_from: day(-4), members: [solo] }),
      event({ id: 5, active: true, starts_on: day(0), ends_on: day(0), tally: [{ code: 'eletro', added_by_name: 'Matt', added_at: new Date().toISOString() }] }),
      event({ id: 7, name: 'Madera Canyon', past: true, starts_on: day(-20), ends_on: day(-20), recap: { species: 142, targets_got: 31, targets_total: 40 } }),
      event({ id: 8, name: 'Sweetwater', past: true, archived: true, starts_on: day(-60), ends_on: day(-60), recap: { species: 60, targets_got: 0, targets_total: 0 } })
    ] }).as('events')
    cy.visit('http://localhost:3000/')
    cy.get('nav a[aria-label="Events"]').click()
    cy.url().should('match', /\/events$/)
    cy.get('[data-testid="events-upcoming"] > li').should('have.length', 2)
    cy.get('[data-testid="events-upcoming"] > li').first().should('contain', 'Chiricahuas').and('contain', 'Today').and('contain', 'Big Day')
    cy.get('[data-testid="events-upcoming"] > li').eq(1).should('contain', 'Patagonia').and('contain', 'Scouting').and('not.contain', 'Big Day')
    cy.get('[data-testid="events-past"]').should('contain', 'Madera Canyon').and('contain', '142 species · 31 of 40 targets')
    cy.get('[data-testid="events-archived"]').should('not.exist')
    cy.contains('button', 'Archived (1)').click()
    cy.get('[data-testid="events-archived"]').should('contain', 'Sweetwater').and('contain', '60 species')
    cy.contains('a', 'New event').should('have.attr', 'href', '/events/new')
  })

  it('a new solo event from a place: Places has no trips, Big Day keeps a lead time already chosen, and it opens on its page', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    const place = { id: 7, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30, home_lat: null, home_lng: null, targets: ['eletro'] }
    cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [place] }).as('places')
    cy.intercept('GET', '**/api/saved?kind=place-suggestions*', { statusCode: 200, body: { suggestions: [] } })
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
    const created = event({ starts_on: day(40), ends_on: day(40), scout_days: 14, scout_from: day(26), role: 'organizer', display_name: null, members: [solo], targets: [{ code: 'eletro' }], invite_url: null, view_url: null })
    cy.intercept('POST', '**/api/saved?kind=event', { statusCode: 201, body: created }).as('create')
    cy.visit('http://localhost:3000/settings?tab=places')
    cy.contains('.place__what', 'Chiricahuas')
    cy.contains('Trips').should('not.exist')
    cy.contains('Add trip dates').should('not.exist')
    cy.contains('.place a', 'New event here').click()
    cy.url().should('include', '/events/new?place=7')
    cy.get('[data-testid="event-where"]').should('contain', 'Chiricahuas').and('contain', 'Cochise')
    cy.get('.event-plan input[name="scout"]').click({ force: true })
    cy.contains('.place__scout-weeks button', '2 weeks').click()
    cy.get('.event-plan input[name="bigday"]').click({ force: true })
    cy.contains('.place__scout-weeks button', '2 weeks').should('have.attr', 'aria-pressed', 'true')
    cy.get('.event-plan input[name="starts_on"]').type(day(40))
    cy.contains('.event-plan', 'starting')
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [created] }).as('events')
    cy.contains('.event-plan button', 'Create event').click()
    cy.wait('@create').its('request.body').should('deep.equal', { name: 'Chiricahuas', starts_on: day(40), ends_on: day(40), kind: 'bigday', scout: true, scout_days: 14, place_id: 7 })
    cy.url().should('match', /\/events\/5$/)
    cy.contains('h1', 'Chiricahuas')
    cy.get('.event-detail__people').should('contain', 'Just you for now.')
    cy.get('.event-detail__plan').should('contain', 'Scouting reports start')
  })

  it('inviting asks once what the group should call you, then gives the invite and view-only links', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
    let current = event({ display_name: null, members: [solo], invite_url: null, view_url: null })
    cy.intercept('GET', '**/api/saved?kind=events*', (req) => req.reply({ statusCode: 200, body: [current] })).as('events')
    cy.intercept('POST', '**/api/saved?kind=event-invite-start*', (req) => {
      current = event({ display_name: req.body.display_name, members: [{ display_name: req.body.display_name, role: 'organizer', you: true }] })
      req.reply({ statusCode: 200, body: current })
    }).as('start')
    cy.intercept('POST', '**/api/saved?kind=event-invite-rotate*', { statusCode: 200, body: event({ invite_url: '/events/join/new789' }) }).as('rotate')
    cy.visit('http://localhost:3000/events/5', { onBeforeLoad: copied })
    cy.get('.event-detail__people .event__members').should('have.text', 'Just you for now.')
    cy.contains('.event-detail__people', 'Plan together: shared targets, scouting and a tally everyone can add to.')
    cy.get('.event-detail__people .event-link').should('not.exist')
    cy.contains('.event-detail__people button', 'Invite your group').should('have.class', 'pill-button--primary').click()
    cy.contains('.event-share', 'What should your group call you?')
    cy.contains('.event-share button', 'Get the invite link').click()
    cy.contains('.event-share', 'Add the name your group knows you by.')
    cy.get('.event-share input[name="display_name"]').type('Matt')
    cy.contains('.event-share button', 'Get the invite link').click()
    cy.wait('@start').its('request.body').should('deep.equal', { display_name: 'Matt' })
    cy.get('.event-detail__people .event__members').should('have.text', 'Matt (organizer)')
    cy.get('.event-detail__people').should('not.contain', 'Plan together').and('not.contain', 'Make a new invite link')
    cy.get('[data-testid="event-invite-link"]').within(() => {
      cy.contains('h3', 'Invite link')
      cy.contains('Anyone with it can join and plan with you.')
      cy.contains('button', 'Share invite link').click()
    })
    cy.get('@copy').should('have.been.calledWith', `${Cypress.config('baseUrl')}/events/join/inv123`)
    cy.get('[data-testid="event-view-link"]').within(() => {
      cy.contains('h3', 'View-only page')
      cy.contains("For people who don't want an account: they see the plan and the day's tally.")
      cy.contains('button', 'Share view-only page').click()
    })
    cy.get('@copy').should('have.been.calledWith', `${Cypress.config('baseUrl')}/events/view/view456`)
    // Resetting the invite link asks first; cancelling sends nothing.
    cy.contains('[data-testid="event-invite-link"] button', 'Reset link').click()
    cy.contains('[data-testid="event-invite-link"]', 'Reset the invite link? Old invite links will stop working.')
    cy.contains('[data-testid="event-invite-link"] button', 'Cancel').click()
    cy.contains('[data-testid="event-invite-link"]', 'Reset the invite link?').should('not.exist')
    cy.contains('[data-testid="event-invite-link"] button', 'Reset link').click()
    cy.contains('[data-testid="event-invite-link"] button', /^Reset$/).click()
    cy.wait('@rotate')
    cy.contains('Invite link reset. Old invite links no longer work.')
  })

  it('invited members show by name, with you as "You" when you have no name', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event({ role: 'member', members: [{ display_name: 'Jane', role: 'organizer' }, { display_name: null, role: 'member', you: true }] })] })
    cy.visit('http://localhost:3000/events/5')
    cy.get('.event-detail__people .event__members').should('have.text', 'Jane (organizer), You')
    cy.get('[data-testid="event-invite-link"]').should('contain', 'Share invite link')
  })

  it('a group event shows whose lifer each target is; archiving is yours; the organizer deletes for everyone', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
    let current = event({ display_name: 'Matt', targets: [{ code: 'eletro', lifer_for: ['Jane', 'Sam'] }, { code: 'mexchi', lifer_for: ['Matt'], lifer_for_you: true }] })
    cy.intercept('GET', '**/api/saved?kind=events*', (req) => req.reply({ statusCode: 200, body: [current] })).as('events')
    cy.intercept('PATCH', '**/api/saved?kind=event-member&id=5', (req) => { current = event({ archived: req.body.archived }); req.reply({ statusCode: 200, body: current }) }).as('member')
    cy.intercept('DELETE', '**/api/saved?kind=event&id=5', { statusCode: 204, body: '' }).as('delete')
    cy.visit('http://localhost:3000/events/5')
    cy.get('.event-detail__people .event__members').should('have.text', 'Matt (organizer), Jane, Sam')
    cy.get('.event__target[data-code="eletro"]').should('contain', 'Elegant Trogon')
    cy.get('.event__target[data-code="eletro"] .event__lifer-mark').should('have.text', 'lifer: Jane, Sam').and('have.attr', 'title', 'lifer for Jane, Sam')
    cy.get('.event__target[data-code="mexchi"]').should('contain', 'Mexican Chickadee').and('not.contain', 'Matt')
    cy.get('.event__target[data-code="mexchi"] .event__lifer-mark').should('have.text', 'lifer').and('have.attr', 'title', 'lifer for you')
    cy.contains('.event-detail__actions button', 'Leave').should('not.exist')
    cy.contains('.event-detail__actions button', /^Archive$/).click()
    cy.wait('@member').its('request.body').should('deep.equal', { archived: true })
    cy.contains('.event-page__what', 'Archived')
    cy.contains('.event-detail__actions button', 'Unarchive').click()
    cy.wait('@member').its('request.body').should('deep.equal', { archived: false })
    cy.get('.Toastify__close-button').click({ multiple: true })
    cy.contains('.event-detail__actions button', 'Delete event').click()
    cy.contains('.event-detail__actions', 'Delete for everyone?')
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [] })
    cy.contains('.event-detail__actions button', /^Delete$/).click()
    cy.wait('@delete')
    cy.url().should('match', /\/events$/)
  })

  it('a member leaves instead of deleting', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event({ role: 'member' })] })
    cy.intercept('POST', '**/api/saved?kind=event-leave*', { statusCode: 204, body: '' }).as('leave')
    cy.visit('http://localhost:3000/events/5')
    cy.contains('.event-detail__people button', 'Reset link').should('not.exist')
    cy.contains('.event-detail__actions button', 'Delete event').should('not.exist')
    cy.contains('.event-detail__actions button', 'Leave').click()
    cy.wait('@leave')
    cy.url().should('match', /\/events$/)
  })

  it("adds every likely lifer not already a target in one tap, up to 50, and says how many", () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    const codes = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`)
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event({ targets: [{ code: 'lif001' }] })] })
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', (req) => {
      expect(req.url).to.include('scope=life').and.include('limit=50')
      req.reply({ statusCode: 200, body: { suggestions: codes(23, 'lif').map((speciesCode) => ({ speciesCode, comName: speciesCode, days: 1, sampled: 7 })) } })
    }).as('suggestions')
    cy.intercept('PUT', '**/api/saved?kind=event-targets&id=5', (req) => req.reply({ statusCode: 200, body: event({ targets: req.body.codes.map((code) => ({ code })) }) })).as('targets')
    cy.visit('http://localhost:3000/events/5')
    cy.contains('.event__add-never-seen', "Add every bird I've never seen (22)").click()
    cy.wait('@targets').its('request.body.codes').should((list) => {
      expect(list).to.have.length(23)
      expect(list[0]).to.eq('lif001', 'existing targets stay first')
      expect(new Set(list).size).to.eq(23)
    })
    cy.contains("Added 22 birds you've never seen.")
  })

  it('the never-seen button stops at the 50-target limit', () => {
    stubAuth({ loggedIn: true })
    stubRegions()
    stubBirds()
    const codes = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`)
    cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [event({ targets: codes(45, 'old').map((code) => ({ code })) })] })
    cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: codes(20, 'lif') } })
    cy.intercept('PUT', '**/api/saved?kind=event-targets&id=5', (req) => req.reply({ statusCode: 200, body: event() })).as('targets')
    cy.visit('http://localhost:3000/events/5')
    cy.contains('.event__add-never-seen', '(5)').click()
    cy.wait('@targets').its('request.body.codes').should('have.length', 50)
  })

  it('home: an event within the week says when, with a way to plan it; back from one says so once', () => {
    stubAuth({ loggedIn: true, user: { ...TEST_USER, upcomingEvent: { id: 6, name: 'Patagonia', starts_on: day(3) }, lastEvent: { id: 4, name: 'Madera Canyon', ended_on: day(-1) } } })
    stubRegions()
    cy.visit('http://localhost:3000/')
    cy.get('[data-testid="upcoming-event"]').should('contain', 'Patagonia').and('contain', 'in 3 days')
    cy.contains('[data-testid="upcoming-event"] a', 'Plan it').should('have.attr', 'href', '/events/6')
    cy.get('[data-testid="welcome-back"]').should('contain', 'Welcome back: alerts are back to Hall County.')
    cy.wait('@patchUser').its('request.body').should('deep.equal', { event_return_seen: true })
    cy.contains('[data-testid="welcome-back"] button', 'OK').click()
    cy.get('[data-testid="welcome-back"]').should('not.exist')
  })

  it('back from an event while still at a place set by hand: the welcome says where alerts are', () => {
    const activePlace = { id: 7, name: 'Colorado (work)', state: 'CO', location: 'US-CO-031', via: 'manual' }
    stubAuth({ loggedIn: true, user: { ...TEST_USER, activePlace, active_place_id: 7, lastEvent: { id: 4, name: 'Madera Canyon', ended_on: day(-1) } } })
    stubRegions()
    cy.visit('http://localhost:3000/')
    cy.get('[data-testid="welcome-back"]').should('contain', 'Welcome back. Your alerts are still set to Colorado (work).')
  })

  it('an invite opened logged out is remembered through signing in, then joins with a name', () => {
    const state = stubAuth({ loggedIn: false })
    cy.intercept('GET', '**/api/saved?kind=event-preview*', { statusCode: 200, body: { name: 'Chiricahuas', area: 'Cochise County, Arizona', starts_on: '2027-05-09', ends_on: '2027-05-09', kind: 'bigday', members: 3 } }).as('preview')
    cy.intercept('POST', '**/api/saved?kind=event-join', { statusCode: 200, body: event({ role: 'member' }) }).as('join')
    cy.visit('http://localhost:3000/events/join/inv123')
    cy.contains('h1', 'Join Chiricahuas')
    cy.contains('.event-page', 'Cochise County, Arizona').and('contain', 'Big Day').and('contain', '3 birders so far')
    cy.contains('.event-page a', 'Log in or sign up').should('have.attr', 'href', '/login?next=%2Fevents%2Fjoin%2Finv123')
    cy.window().then((win) => expect(JSON.parse(win.localStorage.getItem('bird-alert:join')).token).to.eq('inv123'))
    // Signing in (any way) brings them back to the invite.
    cy.then(() => { state.loggedIn = true })
    cy.visit('http://localhost:3000/')
    cy.url().should('include', '/events/join/inv123')
    cy.get('.event-page__join input[name="display_name"]').type('Jane')
    cy.contains('.event-page__join button', 'Join').click()
    cy.wait('@join').its('request.body').should('deep.equal', { token: 'inv123', display_name: 'Jane' })
    cy.url().should('match', /\/events\/5$/)
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
    // Each add names itself (client_id), so a retry after a lost answer isn't a second bird.
    cy.wait('@add').its('request.body').should((body) => {
      expect(body.species_code).to.equal('eletro')
      expect(body.client_id).to.match(/^[0-9a-f-]{36}$/)
    })
    cy.get('[data-testid="tally-count"]').should('contain', '1 species').and('contain', '1 of 2 targets')
    cy.get('.event-tally__list li').first().should('contain', 'Elegant Trogon').and('contain', 'Matt')
    // Taking a bird off asks first (it goes for everyone), then offers Undo.
    cy.get('button[aria-label="Take Elegant Trogon off the tally"]').click()
    cy.contains('.event-tally__confirm', 'Take it off for everyone?').contains('button', 'Take off').click()
    cy.wait('@remove').its('request.url').should('include', 'code=eletro')
    cy.get('[data-testid="tally-count"]').should('contain', '0 species')
    cy.intercept('POST', '**/api/saved?kind=event-tally-undo*', (req) => {
      tally = [{ code: req.body.species_code, added_by_name: 'Matt', added_at: new Date().toISOString() }]
      req.reply({ statusCode: 200, body: event({ active: true, starts_on: day(0), ends_on: day(0), tally }) })
    }).as('undo')
    cy.contains('[data-testid="undo-toast"] button', 'Undo').click()
    cy.wait('@undo').its('request.body').should('deep.equal', { species_code: 'eletro' })
    cy.get('[data-testid="tally-count"]').should('contain', '1 species')
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
