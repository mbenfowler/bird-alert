import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const event = (over = {}) => ({
  id: 5, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30,
  starts_on: day(6), ends_on: day(6), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(-15), active: false,
  role: 'organizer',
  members: [{ display_name: 'Matt', role: 'organizer', you: true }],
  targets: [{ code: 'eletro' }, { code: 'mexchi' }, { code: 'whepar' }],
  tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456',
  ...over
})

const report = (over = {}) => ({
  code: 'eletro', comName: 'Elegant Trogon', locName: 'Cave Creek Canyon', locId: 'L123', lat: 31.88, lng: -109.17,
  obsDt: `${day(-1)} 07:30`, birders: 3, confirmed: true, media: true, subId: 'S100',
  ...over
})

const open = (ev, scouting, user = TEST_USER) => {
  stubAuth({ loggedIn: true, user })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [
    { speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: null },
    { speciesCode: 'mexchi', comName: 'Mexican Chickadee', sciName: 'Poecile sclateri', birdImg: null },
    { speciesCode: 'whepar', comName: 'Whiskered Screech-Owl', sciName: 'Megascops trichopsis', birdImg: null }
  ] })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [ev] })
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: scouting }).as('scouting')
  cy.visit('http://localhost:3000/events/5')
}

describe('Event scouting', () => {
  it('summarises the week, maps numbered places, and gives a card per place with its birds and one checklist', () => {
    open(event(), {
      checked_at: new Date().toISOString(), days_to_go: 6, window: { from: day(-7), to: day(0) }, using: 'targets',
      reported: [
        report(),
        report({ code: 'mexchi', comName: 'Mexican Chickadee', locName: 'Rustler Park', locId: 'L200', obsDt: `${day(-3)} 09:00`, birders: 1, confirmed: null, media: false, subId: 'S200', lat: 31.9, lng: -109.27 }),
        // An older report of the trogon at Cave Creek: one card, one chip, the latest checklist.
        report({ obsDt: `${day(-4)} 06:00`, subId: 'S050' })
      ],
      unreported: [{ code: 'whepar', comName: 'Whiskered Screech-Owl' }]
    })
    cy.wait('@scouting').its('request.url').should('include', 'id=5')
    cy.get('[data-testid="event-scouting"]').within(() => {
      cy.get('.place__heading').should('have.text', 'Scouting · 6 days to go')
      cy.get('.event-scouting__fallback').should('not.exist')
      cy.get('.event-scouting__progress').should('have.text', '2 of 3 targets reported this week')
      cy.get('.event-scouting__progress strong').should('have.text', '2 of 3 targets')
      cy.get('.event-scouting__bar > span').should('have.attr', 'style').and('include', 'width: 67%')
      cy.get('.event-scouting__updated').invoke('text').should('match', /^Updated \d{1,2}:\d{2}/)
      // The map comes before the cards: one pin per place, numbered like them.
      cy.get('.event-scouting__map').next().should('have.class', 'event-scouting__places')
      cy.get('.map-pin').should('have.length', 2)
      cy.get('.map-pin__count').then(els => expect([...els].map(e => e.textContent).sort()).to.deep.equal(['1', '2']))
      cy.get('[data-testid="scout-place"]').should('have.length', 2)
      cy.get('[data-testid="scout-place"]').first().within(() => {
        cy.get('.event-scouting__num').should('have.text', '1')
        cy.get('.event-scouting__place-name').should('have.text', 'Cave Creek Canyon')
        cy.get('.event-scouting__when').should('have.text', 'yesterday')
        cy.get('.event-scouting__count').should('have.text', '1 target')
        cy.get('.event-scouting__bird').should('have.length', 1)
        cy.contains('a.event-scouting__bird', 'Elegant Trogon').should('have.attr', 'href', '/sighting/eletro/S100').find('.event-scouting__ok').should('have.text', '✓')
        cy.get('a.event-scouting__checklist').should('have.length', 1).and('have.text', 'Checklist on eBird')
          .and('have.attr', 'href', 'https://ebird.org/checklist/S100').and('have.attr', 'target', '_blank')
      })
      // An ordinary report eBird never flagged has no confirmed mark or label.
      cy.get('[data-testid="scout-place"]').eq(1).within(() => {
        cy.get('.event-scouting__place-name').should('have.text', 'Rustler Park')
        cy.get('.event-scouting__when').should('have.text', '3 days ago')
        cy.get('.event-scouting__ok').should('not.exist')
        cy.root().should('not.contain', 'onfirmed')
      })
      cy.get('.event-scouting__more-places').should('not.exist')
      cy.contains('.event-scouting__missing .place__subheading', 'Still missing')
      cy.get('.event-scouting__missing .event-scouting__bird--missing').should('have.length', 1).and('have.text', 'Whiskered Screech-Owl')
      cy.contains('Still unreported').should('not.exist')
    })
    // Between the target birds and the people.
    cy.get('[data-testid="event-scouting"]').prev().should('have.class', 'event-detail__targets')
    cy.get('[data-testid="event-scouting"]').next().should('have.class', 'event-detail__people')
  })

  it('sorts places by targets, shows four with the rest behind a button, and folds long bird lists', () => {
    const birds = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7']
    // Seven targets at Big Spot (seen 2 days ago); one each at five other places, the freshest first.
    const reported = [
      ...['P1', 'P2', 'P3', 'P4', 'P5'].map((id, i) => report({ code: `x${i}`, comName: `Other ${i}`, locId: id, locName: `Place ${id}`, obsDt: `${day(-i)} 08:00`, subId: `S${id}`, lat: 31 + i / 10, lng: -109 - i / 10, confirmed: null })),
      ...birds.map((code, i) => report({ code, comName: `Bird ${code}`, locId: 'BIG', locName: 'Big Spot', obsDt: `${day(-2)} 0${i}:00`, subId: i ? `SB${i}` : 'SBIG', lat: 32, lng: -110, confirmed: i === 0 ? true : i === 1 ? false : null }))
    ]
    open(event({ targets: [...birds, 'x0', 'x1', 'x2', 'x3', 'x4', 'gone'].map(code => ({ code })) }), {
      checked_at: new Date().toISOString(), days_to_go: 1, using: 'targets', reported, unreported: [{ code: 'gone', comName: 'Gone Bird' }]
    })
    cy.get('[data-testid="event-scouting"]').within(() => {
      cy.get('.place__heading').should('have.text', 'Scouting · 1 day to go')
      cy.get('.event-scouting__progress').should('have.text', '12 of 13 targets reported this week')
      cy.get('.map-pin').should('have.length', 6)
      cy.get('[data-testid="scout-place"]').should('have.length', 4)
      cy.get('.event-scouting__place-name').then(els => expect([...els].map(e => e.textContent)).to.deep.equal(['Big Spot', 'Place P1', 'Place P2', 'Place P3']))
      cy.get('[data-testid="scout-place"]').first().within(() => {
        cy.get('.event-scouting__count').should('have.text', '7 targets')
        cy.get('.event-scouting__when').should('have.text', '2 days ago')
        cy.get('a.event-scouting__bird').should('have.length', 5)
        cy.get('.event-scouting__ok').should('have.length', 1)
        cy.get('.event-scouting__bird--unconfirmed').should('have.length', 1)
        cy.get('a.event-scouting__checklist').should('have.length', 1)
        cy.contains('button', '+2 more').click()
        cy.get('a.event-scouting__bird').should('have.length', 7)
        cy.contains('button', 'more').should('not.exist')
      })
      cy.contains('button', 'Show 2 more places').click()
      cy.get('[data-testid="scout-place"]').should('have.length', 6)
      cy.get('.event-scouting__more-places').should('not.exist')
    })
  })

  it('tapping a pin reveals, highlights and scrolls to its card', () => {
    const reported = ['P1', 'P2', 'P3', 'P4', 'P5'].map((id, i) => report({ code: `x${i}`, comName: `Other ${i}`, locId: id, locName: `Place ${id}`, obsDt: `${day(-i)} 08:00`, subId: `S${id}`, lat: 31 + i / 5, lng: -109 - i / 5 }))
    open(event(), { checked_at: new Date().toISOString(), days_to_go: 6, using: 'targets', reported, unreported: [] })
    cy.get('[data-testid="event-scouting"]').within(() => {
      cy.get('[data-testid="scout-place"]').should('have.length', 4)
      cy.contains('.map-pin__count', '5').click({ force: true })
      cy.get('[data-testid="scout-place"]').should('have.length', 5)
      cy.get('#scout-place-5').should('have.class', 'is-active').and('contain', 'Place P5')
      cy.get('.event-scouting__place.is-active').should('have.length', 1)
      cy.get('.map-pin--highlight').should('have.length', 1)
    })
    // Retried: the scroll is smooth.
    cy.get('#scout-place-5').should(el => {
      const r = el[0].getBoundingClientRect()
      expect(r.top).to.be.lessThan(Cypress.config('viewportHeight'))
      expect(r.bottom).to.be.greaterThan(0)
    })
  })

  it('fits a phone without scrolling sideways', () => {
    cy.viewport(375, 740)
    const reported = [report({ locName: 'A very long place name for a canyon trailhead parking area and picnic ground' }), ...['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map(code => report({ code, comName: `Long-named Bird ${code} of the Sky Islands` }))]
    open(event(), { checked_at: new Date().toISOString(), days_to_go: 6, using: 'targets', reported, unreported: [{ code: 'whepar', comName: 'Whiskered Screech-Owl' }] })
    cy.get('[data-testid="scout-place"]').should('have.length', 1)
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
  })

  it('with no targets, scouts the likely lifers and says so; nothing reported has its own line', () => {
    open(event({ targets: [] }), {
      checked_at: new Date().toISOString(), days_to_go: 6, window: { from: day(-7), to: day(0) }, using: 'likely_lifers',
      reported: [], unreported: []
    })
    cy.get('[data-testid="event-scouting"]').within(() => {
      cy.contains('.event-scouting__fallback', 'No targets yet, so these are likely lifers for your dates.')
      cy.contains('None of your likely lifers have been reported nearby in the last week.')
      cy.get('[data-testid="scout-place"]').should('not.exist')
      cy.get('.event-scouting__summary').should('not.exist')
      cy.get('.event-scouting__missing').should('not.exist')
      cy.get('.event-scouting__map').should('not.exist')
    })
  })

  it('targets with no reports get the empty line', () => {
    open(event(), { checked_at: null, days_to_go: 6, using: 'targets', reported: [], unreported: [{ code: 'eletro', comName: 'Elegant Trogon' }] })
    cy.get('[data-testid="event-scouting"]').should('contain', 'None of your targets have been reported nearby in the last week.')
    cy.get('[data-testid="event-scouting"] .event-scouting__progress').should('have.text', '0 of 1 target reported this week')
    cy.get('[data-testid="scouting-progress"]').should('have.text', '0 of 1 target around this week')
    cy.get('.event-scouting__updated').should('not.exist')
    cy.get('.event-scouting__bird--missing').should('have.text', 'Elegant Trogon')
  })

  describe('Email me the scouting report now', () => {
    const EMPTY = { checked_at: null, days_to_go: 6, using: 'likely_lifers', reported: [], unreported: [] }
    const press = (reply) => {
      cy.intercept('POST', '**/api/saved?kind=event-scouting-email*', reply).as('email')
      cy.contains('[data-testid="event-scouting"] button', 'Email me the scouting report now').click()
    }

    it('shows even with no targets and nothing reported, near the heading', () => {
      open(event({ targets: [] }), EMPTY)
      cy.get('[data-testid="event-scouting"] .place__heading').next().should('have.class', 'event-scouting__email')
        .find('button').should('have.text', 'Email me the scouting report now').and('be.enabled')
    })

    it('says Sending… while it goes, then where it went; the button stays usable', () => {
      open(event(), EMPTY)
      press({ statusCode: 200, body: { sent: true, to: 'm•••@gmail.com' }, delay: 400 })
      cy.contains('button', 'Sending…').should('be.disabled')
      cy.wait('@email').then(({ request }) => {
        expect(request.url).to.include('id=5')
        expect(request.headers).to.have.property('x-bird-alert', '1')
      })
      cy.get('.event-scouting__email [role="status"]').should('have.text', 'Sent to m•••@gmail.com. Check your inbox.')
      cy.contains('button', 'Email me the scouting report now').should('be.enabled')
    })

    it('a confirmed address has no reminder', () => {
      open(event(), EMPTY)
      cy.get('.event-scouting__email button').should('have.length', 1)
      cy.get('.event-scouting__confirm').should('not.exist')
    })

    it('an unconfirmed address: a reminder beside the button, and a resend that says it went', () => {
      open(event(), EMPTY, { ...TEST_USER, email_confirmed: false })
      cy.get('.event-scouting__email').within(() => {
        cy.contains('button', 'Email me the scouting report now').should('be.enabled')
        cy.get('.event-scouting__confirm').should('contain', 'Confirm your email to get scouting reports.')
        cy.contains('button', 'Resend confirmation email').click()
      })
      cy.wait('@resendConfirmation')
      cy.get('.event-scouting__email [role="status"]').should('have.text', 'Sent. Check your inbox (and spam).')
      cy.contains('button', 'Resend confirmation email').should('not.exist')
    })

    it('a 409 confirm_email shows the same reminder line', () => {
      open(event(), EMPTY)
      press({ statusCode: 409, body: { error: 'confirm_email' } })
      cy.wait('@email')
      cy.get('.event-scouting__confirm').should('contain', 'Confirm your email to get scouting reports.')
        .find('button').should('have.text', 'Resend confirmation email')
      cy.get('.event-scouting__email .place-form__error').should('not.exist')
    })

    it('too many asks says how long to wait', () => {
      open(event(), EMPTY)
      press({ statusCode: 429, body: { error: 'too_many', retry_after_min: 12 } })
      cy.get('.event-scouting__email [role="alert"]').should('have.text', 'You’ve asked for a few already. Try again in 12 minutes.')
    })

    it('the daily mail cap says try later', () => {
      open(event(), EMPTY)
      press({ statusCode: 503, body: { error: 'mail_cap' } })
      cy.get('.event-scouting__email [role="alert"]').should('have.text', 'Email is busy right now. Try again later.')
    })

    it('an event that is over hides the button', () => {
      open(event(), EMPTY)
      press({ statusCode: 400, body: { error: 'event_over' } })
      cy.wait('@email')
      cy.get('.event-scouting__email').should('not.exist')
    })

    it('any other failure gives the short error line', () => {
      open(event(), EMPTY)
      press({ statusCode: 500, body: { error: 'Could not send the email' } })
      cy.get('.event-scouting__email .place-form__error').should('have.text', 'Could not send the email')
      cy.contains('button', 'Email me the scouting report now').should('be.enabled')
    })

    it('fits a phone with a long answer and the reminder beside it', () => {
      cy.viewport(375, 740)
      open(event(), EMPTY, { ...TEST_USER, email_confirmed: false })
      press({ statusCode: 429, body: { error: 'too_many', retry_after_min: 45 } })
      cy.get('.event-scouting__email [role="alert"]').should('exist')
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(375))
    })
  })

  it('a past event has no scouting', () => {
    open(event({ past: true, starts_on: day(-20), ends_on: day(-20), recap: { species: 50, targets_got: 1, targets_total: 3 } }), { using: 'targets', reported: [], unreported: [] })
    cy.get('.event-detail__targets').should('exist')
    cy.get('[data-testid="event-scouting"]').should('not.exist')
  })
})
