import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'

const COCHISE = 'US-AZ-003'
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const pad = (n) => String(n).padStart(2, '0')

const event = (over = {}) => ({
  id: 5, name: 'Chiricahuas', state: 'AZ', location: COCHISE, range_mi: 30,
  starts_on: day(6), ends_on: day(6), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(-15), active: false,
  role: 'organizer', display_name: null,
  members: [{ display_name: null, role: 'organizer', you: true }],
  targets: [{ code: 'eletro' }, { code: 'mexchi' }, { code: 'whepar' }],
  tally: [],
  invite_url: null, view_url: null,
  ...over
})

const fresh = (over = {}) => ({ code: 'rubrob', speciesCode: 'rubrob', comName: 'Rufous-backed Robin', locName: 'Tubac', locId: 'L1', obsDt: `${day(0)} 07:40`, aba: 3, flagged: false, ...over })

const SCOUTING = {
  checked_at: new Date().toISOString(), days_to_go: 6, using: 'targets',
  headline: '3 exciting birds near Chiricahuas: Rufous-backed Robin and more',
  reported: [{ code: 'eletro', comName: 'Elegant Trogon', locName: 'Cave Creek Canyon', locId: 'L123', lat: 31.88, lng: -109.17, obsDt: `${day(-1)} 07:30`, subId: 'S100' }],
  unreported: [{ code: 'whepar', comName: 'Whiskered Screech-Owl' }],
  fresh: [
    fresh({ code: 'eletro', comName: 'Elegant Trogon', locName: 'Cave Creek Canyon', aba: 2, obsDt: `${day(-1)} 16:00` }),
    fresh(),
    fresh({ code: 'mexchi', comName: 'Mexican Chickadee', locName: 'Rustler Park', aba: 2, obsDt: `${day(0)} 15:10` }),
    fresh({ code: 'tufflc', comName: 'Tufted Flycatcher', locName: 'Ramsey Canyon', aba: 4, obsDt: `${day(-2)} 09:00` })
  ],
  bird_of_day: {
    code: 'tufflc', speciesCode: 'tufflc', comName: 'Tufted Flycatcher', locName: 'Ramsey Canyon', obsDt: `${day(0)} 08:15`, aba: 4,
    evidence: { confirmed: true, media: true, birders: 4 }, photo: 'https://upload.wikimedia.org/tufflc.jpg'
  },
  targets: [
    { code: 'eletro', comName: 'Elegant Trogon', status: 'around', last_obs_dt: `${day(-1)} 07:30`, last_loc_name: 'Cave Creek Canyon', aba: 2, lifer: false },
    { code: 'mexchi', comName: 'Mexican Chickadee', status: 'quiet', last_obs_dt: null, last_loc_name: null, aba: 2, lifer: true },
    { code: 'whepar', comName: 'Whiskered Screech-Owl', status: 'missing', last_obs_dt: null, last_loc_name: null, aba: 1, lifer: false }
  ]
}

const stubAll = (ev, scouting) => {
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: COCHISE, name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', (req) => {
    const codes = new URL(req.url).searchParams.get('codes')?.split(',') ?? []
    req.reply({ statusCode: 200, body: codes.map(code => ({ speciesCode: code, comName: code, sciName: '', birdImg: null })) })
  })
  cy.intercept('GET', 'https://upload.wikimedia.org/**', { fixture: 'tile.png' })
  cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
  cy.intercept('GET', '**/api/saved?kind=event-route*', { statusCode: 200, body: { from: null, stops: [], extras: [], total_min: null, total_mi: null, covered: 0, reported: 0, skipped: 0, geometry: [], routed: false } })
  cy.intercept('GET', '**/api/saved?kind=event-route-plan*', { statusCode: 200, body: { start: null, stops: null, version: 0, position: null } })
  cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [ev] }).as('events')
  cy.intercept('GET', '**/api/saved?kind=event-scouting*', { statusCode: 200, body: scouting }).as('scouting')
}

const open = (ev, scouting, path = '/events/5', options = {}) => {
  stubAuth({ loggedIn: true, user: TEST_USER })
  stubAll(ev, scouting)
  cy.visit(`http://localhost:3000${path}`, options)
}

const noSidewaysScroll = () => cy.document().then(doc => expect(doc.documentElement.scrollWidth, 'no sideways scroll').to.be.at.most(doc.documentElement.clientWidth))

/** The card is scrolled to (just under the sticky nav) and lit up for a moment. */
const landedOnCard = () => {
  cy.get('#scouting').should('have.attr', 'data-flash')
  cy.window().its('scrollY').should('be.greaterThan', 0)
  cy.get('#scouting').should(($el) => {
    const top = $el[0].getBoundingClientRect().top
    expect(top).to.be.within(40, 120)
  })
  cy.focused().should('have.id', 'scouting')
  cy.get('#scouting', { timeout: 5000 }).should('not.have.attr', 'data-flash')
}

describe("Today's scouting", () => {
  it('leads with the push line, new reports rarest first, the bird of the day and the progress line', () => {
    open(event(), SCOUTING)
    cy.get('[data-testid="scouting-today"]').within(() => {
      cy.contains('h2', 'Today’s scouting')
      cy.get('[data-testid="scouting-headline"]').should('have.text', '3 exciting birds near Chiricahuas: Rufous-backed Robin and more')
      cy.contains('.place__subheading', 'New since yesterday')
      cy.get('[data-testid="scouting-fresh"]').should('have.length', 4)
      // Rarest first (ABA 4, 3, then the 2s in the server's order), each with where and when.
      cy.get('[data-testid="scouting-fresh"]').then(rows => expect([...rows].map(r => r.querySelector('strong').textContent))
        .to.deep.equal(['Tufted Flycatcher', 'Rufous-backed Robin', 'Elegant Trogon', 'Mexican Chickadee']))
      cy.get('[data-testid="scouting-fresh"]').eq(1).should('have.text', 'Rufous-backed Robin ABA Code 3 · a few each year · Tubac · this morning')
        .and('have.attr', 'data-aba', '3')
      cy.get('[data-testid="scouting-fresh"]').eq(0).find('.aba-code').should('contain', 'ABA Code 4')
      cy.get('[data-testid="scouting-fresh"]').eq(0).should('contain', 'Ramsey Canyon · 2 days ago')
      cy.get('[data-testid="scouting-fresh"]').eq(2).should('contain', 'Cave Creek Canyon · yesterday').find('.aba-code').should('not.exist')
      cy.get('[data-testid="scouting-fresh"]').eq(3).should('contain', 'Rustler Park · today')
      // Heat edge by ABA code.
      cy.get('[data-testid="scouting-fresh"]').eq(0).should('have.css', 'border-left-color', 'rgb(224, 86, 27)')
      cy.get('[data-testid="bird-of-day"]').within(() => {
        cy.contains('Bird of the day')
        cy.contains('strong', 'Tufted Flycatcher')
        cy.get('.aba-code').should('contain', 'ABA Code 4')
        cy.contains('Ramsey Canyon · this morning')
        cy.get('.evidence').should('contain', 'Confirmed').and('contain', '4 birders')
        cy.get('img').should('have.attr', 'src', 'https://upload.wikimedia.org/tufflc.jpg').and('have.attr', 'width', '64')
      })
      cy.get('[data-testid="scouting-progress"]').should('have.text', '1 of 3 targets around this week')
      cy.get('[data-testid="scouting-none-new"]').should('not.exist')
    })
    // Above the route, the targets and the scouting details.
    cy.get('[data-testid="scouting-today"]').then(card => {
      const top = card[0].getBoundingClientRect().top
      for (const sel of ['[data-testid="event-route"]', '#event-targets', '#scouting-details', '.event-detail__people']) {
        cy.get(sel).should(el => expect(el[0].getBoundingClientRect().top).to.be.greaterThan(top))
      }
    })
    cy.get('#event-targets').next().should('have.id', 'scouting-details')
    cy.get('#scouting-details').next().should('have.class', 'event-detail__people')
    // "See where" goes down to the places and the map.
    cy.contains('[data-testid="scouting-today"] a', 'See where →').click()
    cy.get('#scouting-details').should(el => expect(el[0].getBoundingClientRect().top).to.be.within(0, 140))
  })

  it('shows five new reports, then "+N more"', () => {
    const many = Array.from({ length: 8 }, (_, i) => fresh({ code: `b${i}`, comName: `Bird ${i}`, aba: i === 6 ? 5 : 1 }))
    open(event(), { ...SCOUTING, fresh: many, bird_of_day: { ...SCOUTING.bird_of_day, evidence: 'Reviewed and accepted by eBird', photo: null } })
    cy.get('[data-testid="scouting-fresh"]').should('have.length', 5)
    cy.get('[data-testid="scouting-fresh"]').first().should('contain', 'Bird 6').and('have.attr', 'data-aba', '5')
    // The live server sends the reviewer line as text, as the email shows it.
    cy.get('[data-testid="bird-of-day"] .scouting-today__evidence').should('have.text', 'Reviewed and accepted by eBird')
    cy.contains('[data-testid="scouting-today"] button', '+3 more').click()
    cy.get('[data-testid="scouting-fresh"]').should('have.length', 8)
    cy.contains('[data-testid="scouting-today"] button', 'more').should('not.exist')
  })

  it('says quietly when nothing is new, with the progress line', () => {
    open(event(), { ...SCOUTING, headline: null, fresh: [], bird_of_day: null })
    cy.get('[data-testid="scouting-today"]').within(() => {
      cy.get('[data-testid="scouting-none-new"]').should('have.text', 'No new target reports since yesterday')
      cy.get('[data-testid="scouting-fresh"]').should('not.exist')
      cy.get('[data-testid="bird-of-day"]').should('not.exist')
      cy.get('[data-testid="scouting-headline"]').should('not.exist')
      cy.get('[data-testid="scouting-progress"]').should('have.text', '1 of 3 targets around this week')
    })
  })

  it('works before the backend sends the new fields: progress from the reports, no card news', () => {
    open(event(), { using: 'targets', reported: SCOUTING.reported, unreported: SCOUTING.unreported })
    cy.get('[data-testid="scouting-none-new"]').should('exist')
    cy.get('[data-testid="scouting-progress"]').should('have.text', '1 of 2 targets around this week')
    cy.get('#event-targets [data-status="around"]').should('contain', 'Elegant Trogon')
    cy.get('#event-targets [data-status="missing"]').should('contain', 'Whiskered Screech-Owl')
  })

  it('outside the scouting window it shows only when there is news', () => {
    open(event({ scout: false, scout_from: null }), { ...SCOUTING, headline: null, fresh: [], bird_of_day: null })
    cy.wait('@scouting')
    cy.get('#event-targets')
    cy.get('[data-testid="scouting-today"]').should('not.exist')
  })

  it('#scouting scrolls to the card and lights it up', () => {
    cy.viewport(390, 760)
    open(event(), SCOUTING, '/events/5#scouting')
    landedOnCard()
    noSidewaysScroll()
  })

  it('#scouting survives logging in', () => {
    stubAuth()
    stubAll(event(), SCOUTING)
    cy.visit('http://localhost:3000/events/5#scouting', { onBeforeLoad: (win) => win.localStorage.setItem('bird-alert:passkey-offer-dismissed', '1') })
    cy.location('pathname').should('eq', '/login')
    cy.location('search').should('eq', '?next=%2Fevents%2F5%23scouting')
    cy.get('.input.email').type('robin@example.com{enter}')
    cy.wait('@userExists')
    cy.get('.input.password').type('password123{enter}')
    cy.wait('@login')
    cy.location('pathname').should('eq', '/events/5')
    cy.location('hash').should('eq', '#scouting')
    landedOnCard()
  })

  it('#scouting with the card already saved and no signal still lands on it', () => {
    open(event(), SCOUTING)
    cy.get('[data-testid="scouting-headline"]')
    // The persisted cache is written shortly after the data arrives.
    cy.window().should(win => expect(win.localStorage.getItem('bird-alert-query-cache') ?? '').to.include('event-scouting'))
    cy.intercept('GET', '**/api/saved?kind=event-scouting*', { forceNetworkError: true }).as('noSignal')
    cy.intercept('GET', '**/api/saved?kind=events*', { forceNetworkError: true })
    cy.visit('http://localhost:3000/events/5#scouting')
    cy.get('[data-testid="scouting-headline"]').should('contain', '3 exciting birds')
    landedOnCard()
  })
})

describe('Targets', () => {
  // 50 targets: 30 around (one a day apart), 8 quiet, 12 missing; some rare, some lifers.
  const targets = Array.from({ length: 50 }, (_, i) => {
    const status = i < 30 ? 'around' : i < 38 ? 'quiet' : 'missing'
    return {
      code: `t${pad(i)}`, comName: `Bird ${pad(i)}`, status,
      last_obs_dt: status === 'around' ? `${day(-(i % 7))} ${pad(6 + (i % 10))}:00` : null,
      last_loc_name: status === 'around' ? 'Ramsey Canyon' : null,
      aba: i === 20 ? 4 : i === 45 ? 3 : 1,
      lifer: i === 25 || i === 40
    }
  })
  const big = event({ targets: targets.map(t => ({ code: t.code })) })
  const scouting = { ...SCOUTING, reported: [], unreported: [], targets, fresh: [], bird_of_day: null }
  const chips = () => cy.get('[data-testid="event-target-chips"] > li')
  const codes = (els) => [...els].map(el => el.getAttribute('data-code'))

  it('sorts by usefulness, shows 20 then all 50 and back, with status filters and counts', () => {
    open(big, scouting)
    chips().should('have.length', 20)
    chips().should(els => {
      const order = codes(els)
      // Around first: the lifer and the rare one (newest first), then the rest newest first.
      expect(order.slice(0, 2)).to.deep.equal(['t25', 't20'])
      const dates = order.slice(2).map(c => targets.find(t => t.code === c).last_obs_dt)
      expect([...dates].sort().reverse()).to.deep.equal(dates)
      expect(els.toArray().every(el => el.getAttribute('data-status') === 'around')).to.eq(true)
    })
    cy.contains('#event-targets button', 'Show all 50').click()
    chips().should('have.length', 50)
    chips().should(els => {
      const order = codes(els)
      // Quiet after around; missing last with its rare bird and lifer first.
      expect(order.slice(30, 38).every(c => targets.find(t => t.code === c).status === 'quiet')).to.eq(true)
      expect(order.slice(38, 40)).to.deep.equal(['t40', 't45'])
    })
    cy.contains('#event-targets button', 'Show fewer').click()
    chips().should('have.length', 20)

    cy.get('.event-targets__filter button').then(els => expect([...els].map(e => e.textContent)).to.deep.equal(['All (50)', 'Around this week (30)', 'Missing (12)']))
    cy.contains('.event-targets__filter button', 'Missing (12)').click()
    cy.contains('.event-targets__filter button', 'Missing (12)').should('have.attr', 'aria-pressed', 'true')
    chips().should('have.length', 12).each(el => expect(el).to.have.attr('data-status', 'missing'))
    cy.contains('#event-targets button', 'Show all').should('not.exist')
    cy.contains('.event-targets__filter button', 'Around this week (30)').click()
    chips().should('have.length', 20)
    cy.contains('#event-targets button', 'Show all 30')
  })

  it('searches once there are more than 20', () => {
    open(big, scouting)
    cy.get('.event-targets__search').type('bird 4')
    chips().should('have.length', 10)
    cy.get('.event-targets__search').clear()
    cy.get('.event-targets__search').type('zzz')
    cy.contains('#event-targets', 'No targets match “zzz”.')
    cy.get('.event-targets__search').clear()
    chips().should('have.length', 20)
  })

  it('no search box with 20 or fewer', () => {
    open(event(), SCOUTING)
    cy.get('[data-testid="event-target-chips"]')
    cy.get('.event-targets__search').should('not.exist')
    cy.get('.event-targets__filter').should('exist')
  })

  it('each chip says where it stands: green dot with when and where, muted missing, lifer, ABA badge', () => {
    open(big, scouting)
    cy.get('[data-code="t20"]').within(() => {
      cy.get('.event__dot').should('have.css', 'background-color', 'rgb(31, 157, 85)')
      cy.get('.aba-code').should('have.text', 'ABA 4').and('have.attr', 'title').and('include', 'Code 4')
    })
    const t20 = targets[20]
    cy.get('[data-code="t20"]').invoke('attr', 'title').should('match', new RegExp(`^Reported [A-Z][a-z]{2} \\d{1,2} at Ramsey Canyon$`))
    cy.get('[data-code="t20"]').invoke('attr', 'title').should('include', String(Number(t20.last_obs_dt.slice(8, 10))))
    cy.get('[data-code="t25"] .event__lifer-mark').should('have.text', 'lifer')
    cy.get('[data-code="t00"] .event__lifer-mark').should('not.exist')
    cy.get('[data-code="t00"] .aba-code').should('not.exist')
    cy.contains('.event-targets__filter button', 'Missing').click()
    cy.get('[data-code="t40"]').should('have.class', 'event__target--missing').and('contain', 'not reported lately')
      .and('have.css', 'color').and('not.eq', 'rgb(0, 0, 0)')
    cy.get('[data-code="t40"] .event__dot').should('not.exist')
    cy.get('[data-code="t45"] .aba-code').should('have.text', 'ABA 3')
  })

  it('on the day, a ✓ on targets already on the tally', () => {
    open(event({ active: true, starts_on: day(0), ends_on: day(0), tally: [{ code: 'mexchi', added_by_name: 'Matt', added_at: new Date().toISOString() }] }), SCOUTING)
    cy.get('[data-testid="scouting-today"]').should('not.exist')
    cy.get('[data-code="mexchi"] .event__got').should('contain', '✓').and('contain', 'On the tally')
    cy.get('[data-code="eletro"] .event__got').should('not.exist')
  })

  it('removing takes a second tap on the same chip, and goes back on its own', () => {
    open(event(), SCOUTING)
    cy.intercept('PUT', '**/api/saved?kind=event-targets&id=5', (req) => req.reply({ statusCode: 200, body: event({ targets: req.body.codes.map(code => ({ code })) }) })).as('targets')
    cy.get('[data-code="whepar"] button[aria-label="Remove Whiskered Screech-Owl"]').click()
    cy.get('[data-code="whepar"] .event__remove-yes').should('have.text', 'Remove?')
    cy.get('[data-code="whepar"]').should('have.class', 'is-confirming')
    // Nothing is sent on the first tap; after a moment it goes back to the ×.
    cy.get('@targets.all').should('have.length', 0)
    cy.get('[data-code="whepar"] .event__remove-yes', { timeout: 6000 }).should('not.exist')
    cy.get('[data-code="whepar"] button[aria-label="Remove Whiskered Screech-Owl"]').click()
    cy.get('[data-code="whepar"] button[aria-label="Yes, remove Whiskered Screech-Owl"]').click()
    cy.wait('@targets').its('request.body.codes').should('deep.equal', ['eletro', 'mexchi'])
  })

  it('fits a phone: 375 wide with 50 targets, the filter and the search', () => {
    cy.viewport(375, 740)
    open(big, { ...SCOUTING, targets })
    chips().should('have.length', 20)
    cy.get('.event-targets__search')
    noSidewaysScroll()
    cy.contains('#event-targets button', 'Show all 50').click()
    noSidewaysScroll()
  })
})
