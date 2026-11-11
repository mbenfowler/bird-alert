import { stubAuth } from '../support/stubs'
import { membersRecap, publicRecap } from '../../src/components/Recap/recapFixture'

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// The event as the events list has it: over since yesterday.
const event = (over = {}) => ({
  id: 2, name: 'Big Day 2027', state: 'AZ', location: 'US-AZ-003', range_mi: 30, timezone: 'America/Phoenix',
  starts_on: day(-1), ends_on: day(-1), kind: 'bigday', scout: false, active: false, past: true,
  role: 'organizer', display_name: 'Matt',
  members: [{ display_name: 'Matt', role: 'organizer', you: true }, { display_name: 'Kirin', role: 'member' }],
  targets: [], tally: [], invite_url: '/events/join/inv123', view_url: '/events/view/view456',
  ...over
})

// The fake server's tally, so a fix shows after the events list is fetched again.
const stubPage = (recap, tally = []) => {
  stubAuth({ loggedIn: true })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/api/saved?kind=events*', (req) => req.reply({ statusCode: 200, body: [event({ tally })] })).as('events')
  cy.intercept('GET', '**/api/saved?kind=event-recap&event=2*', recap).as('recap')
  cy.intercept('GET', '**/api/saved?kind=event-recap&share=*', { statusCode: 200, body: publicRecap() }).as('shared')
}

const copied = (win) => cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves()

describe('Event recap', () => {
  it('no bird placed at any stop: the stops show without a column of +0', () => {
    const recap = membersRecap()
    recap.stops = recap.stops.map((s) => ({ ...s, added: 0, species: 0 }))
    recap.totals.bestStop = null
    stubPage({ statusCode: 200, body: recap })
    cy.visit('/events/2')
    cy.wait('@recap')
    cy.get('[data-testid="recap-stops"] li').should('have.length', 6)
    cy.get('[data-testid="recap-stops"] .recap-stop__count').should('not.exist')
  })

  it('leads the event page once it is over, with the plan folded away below', () => {
    stubPage({ statusCode: 200, body: membersRecap() })
    cy.visit('/events/2', { onBeforeLoad: copied })
    cy.wait('@recap')
    cy.get('[data-testid="recap-count"]').should('contain', '92').and('contain', 'species')
    cy.get('[data-testid="recap-crew"]').should('have.text', 'Matt (organizer) · Kirin')
    // One card per species: the robin and the pipit were lifers for both.
    cy.get('[data-testid="recap-lifers"] [role="group"]').should('have.length', 6).first().should('contain', 'Arizona Woodpecker').and('contain', 'Lifer for Kirin (#208)')
    cy.get('[data-testid="recap-lifers"] [role="group"]').eq(2).should('contain', 'Lifer for Kirin (#210) and Matt (#431)')
    cy.get('[data-testid="recap-rarest"]').should('contain', 'Rufous-backed Robin').and('contain', 'ABA Code 3')
    cy.get('[data-testid="recap-stops"] li').should('have.length', 6).eq(2).should('contain', '+20').and('contain', 'best')
    cy.get('[data-testid="recap-who"]').should('contain', 'Who found what').and('contain', 'Only Matt (13)')
    cy.get('[data-testid="event-planning"]').should('not.have.attr', 'open')

    // 7:31 AM sits 20.9% across the curve (5 AM to 7 PM, inside the chart's margins).
    cy.get('[data-testid="recap-curve"]').then(($plot) => {
      const box = $plot[0].getBoundingClientRect()
      cy.wrap($plot).trigger('pointermove', { clientX: box.left + box.width * 0.209, clientY: box.top + box.height / 2, force: true })
    })
    cy.get('[data-testid="recap-tip"]').should('contain', '#27 · Bridled Titmouse').and('contain', 'Ramsey Canyon').and('contain', 'Lifer for Kirin')

    cy.get('[data-testid="recap-copy"]').click()
    cy.get('@copy').should('have.been.calledWithMatch', /\/recap\/2-k3x9qa$/)

    // The link's view: no names, no who found what.
    cy.get('[data-testid="recap-preview"]').click()
    cy.wait('@shared')
    cy.get('[data-testid="recap"]').should('have.attr', 'data-audience', 'public')
    cy.get('[data-testid="recap-crew"]').should('have.text', 'A group of birders, with Bird Alert')
    cy.get('[data-testid="recap-who"]').should('not.exist')
    cy.get('[data-testid="recap"]').should('not.contain', 'Kirin')
    cy.contains('button', 'Back to the members view').click()
    cy.get('[data-testid="recap-who"]').should('exist')
  })

  it('fills in the recap through the tally queue while fixes are open', () => {
    const tally = []
    stubPage({ statusCode: 200, body: membersRecap() }, tally)
    cy.intercept('POST', '**/api/saved?kind=event-tally*', (req) => {
      tally.push({ id: 9, code: req.body.species_code, added_by_name: 'Matt', added_by_you: true, added_at: new Date().toISOString() })
      req.reply({ statusCode: 200, body: event({ tally }) })
    }).as('add')
    cy.visit('/events/2')
    cy.get('[data-testid="recap-fill"] summary').click()
    cy.get('[data-testid="recap-fill"] input[type="search"]').type('trogon')
    cy.get('[data-testid="recap-fill"] li').should('have.length', 1)
    cy.contains('[data-testid="recap-fill"] label', 'Elegant Trogon').find('input').check()
    cy.wait('@add').its('request.body').should('include', { species_code: 'eletro' })
    cy.contains('[data-testid="recap-fill"] label', 'Elegant Trogon').find('input').should('be.checked')
  })

  it('shows a sealed recap without the check-off', () => {
    stubPage({ statusCode: 200, body: membersRecap({ status: 'sealed', candidates: [] }) })
    cy.visit('/events/2')
    cy.get('[data-testid="recap-count"]').should('contain', '92')
    cy.get('[data-testid="recap-fill"]').should('not.exist')
    cy.contains('this recap is final')
  })

  it('leaves a live event as it was (not_ended)', () => {
    stubPage({ statusCode: 409, body: { error: 'not_ended' } })
    cy.visit('/events/2')
    cy.wait('@recap')
    cy.contains('h1', 'Big Day 2027')
    cy.get('[data-testid="recap"]').should('not.exist')
    cy.get('[data-testid="event-planning"]').should('not.exist')
  })

  it('opens the share link with no account, and no names', () => {
    stubAuth({ loggedIn: false })
    cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
    cy.intercept('GET', '**/api/saved?kind=event-recap&share=2-k3x9qa*', { statusCode: 200, body: publicRecap() }).as('shared')
    cy.visit('/recap/2-k3x9qa')
    cy.wait('@shared')
    cy.location('pathname').should('eq', '/recap/2-k3x9qa')
    cy.get('[data-testid="recap-count"]').should('contain', '92')
    cy.get('[data-testid="recap-who"]').should('not.exist')
    cy.get('[data-testid="recap-preview"]').should('not.exist')
    cy.get('[data-testid="recap-lifers"] [role="group"]').eq(2).should('contain', 'A lifer for two of us')
    cy.get('[data-testid="recap-lifers"] [role="group"]').first().should('contain', 'A lifer for one of us')
    cy.get('[data-testid="recap-scouting"]').should('contain', 'A lifer for the group').and('not.contain', 'Matt')
    cy.contains('a', 'Get Bird Alert').should('have.attr', 'href', '/login?next=%2Frecap%2F2-k3x9qa')
  })

  describe('the sample day (/recap/demo)', () => {
    const visitDemo = () => {
      stubAuth({ loggedIn: false })
      cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
      cy.visit('/recap/demo')
      cy.get('[data-testid="recap-count"]').should('contain', '92')
      // The test's own clock from here (the page's sign-in check needs the real one to load); a
      // focus and a blur pause the carousel and start its wait again, on that clock.
      cy.clock(Date.now(), ['setTimeout', 'clearTimeout'])
      cy.get('[data-testid="recap-lifers"]').scrollIntoView()
      cy.get('[data-testid="recap-lifers"]').focus()
      cy.get('[data-testid="recap-lifers"]').blur()
    }
    // Slides at least half inside the carousel's window.
    const inView = ($carousel) => {
      const box = $carousel[0].querySelector('.carousel__viewport').getBoundingClientRect()
      return [...$carousel[0].querySelectorAll('.carousel__slide')].filter(el => {
        const r = el.getBoundingClientRect()
        return Math.min(r.right, box.right) - Math.max(r.left, box.left) > r.width / 2
      })
    }

    it('moves the lifers along on their own, three at most, with the controls staying put', () => {
      visitDemo()
      cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-mode', 'wide')
        .and('have.attr', 'aria-roledescription', 'carousel').and('have.attr', 'data-current', '0')
      cy.get('[data-testid="recap-lifers"]').should(($c) => {
        const shown = inView($c)
        expect(shown).to.have.length(3)
        expect(shown[0].textContent).to.contain('Arizona Woodpecker')
      })
      cy.get('[data-testid="recap-lifers"] .carousel__dot').should('have.length', 6).first().should('have.attr', 'aria-current', 'true')
      cy.get('[data-testid="recap-lifers"] [aria-label="Next"]').then(($next) => {
        const before = $next[0].getBoundingClientRect()
        cy.tick(4000)
        cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-current', '1')
        cy.get('[data-testid="recap-lifers"] .carousel__dot').eq(1).should('have.attr', 'aria-current', 'true')
        cy.get('[data-testid="recap-lifers"]').should(($c) => {
          const shown = inView($c)
          expect(shown).to.have.length(3)
          expect(shown[0].textContent).to.contain('Bridled Titmouse')
        })
        cy.get('[data-testid="recap-lifers"] [aria-label="Next"]').should(($after) => {
          const after = $after[0].getBoundingClientRect()
          expect(after.left).to.equal(before.left)
          expect(after.top).to.equal(before.top)
        })
      })

      // Round the end and back to the first, through a copy.
      cy.get('[data-testid="recap-lifers"] [aria-label="Show 6 of 6"]').click()
      cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-current', '5')
      cy.get('[data-testid="recap-lifers"] [aria-label="Next"]').click()
      cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-current', '0')

      // A pointer over it holds it still.
      cy.get('[data-testid="recap-lifers"]').trigger('pointerover', { pointerType: 'mouse' })
      cy.get('[data-testid="recap-lifers"] [aria-label="Next"]').blur()
      cy.tick(8000)
      cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-current', '0')
    })

    it('shows one centred, its neighbours at the edges, on a phone', () => {
      cy.viewport(390, 844)
      visitDemo()
      cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-mode', 'narrow')
      cy.get('[data-testid="recap-lifers"]').should(($c) => {
        const box = $c[0].querySelector('.carousel__viewport').getBoundingClientRect()
        const current = $c[0].querySelector('.carousel__slide:not(.is-side)').getBoundingClientRect()
        expect(Math.abs((current.left + current.right) / 2 - (box.left + box.right) / 2)).to.be.lessThan(2)
        expect(inView($c)).to.have.length(1)
      })
      cy.tick(4000)
      cy.get('[data-testid="recap-lifers"]').should('have.attr', 'data-current', '1')
    })

    it('stars the bird the scouting called, then the rest it found', () => {
      visitDemo()
      cy.get('[data-testid="recap-scout-star"]').should('have.text', "Lewis's Woodpecker")
      cy.get('[data-testid="recap-scouting"]').should('contain', 'Lifer for Matt').and('contain', 'Bird of the day')
        .and('contain', 'In the scouting 3 times from Nov 7 · reported at Willcox Twin Lakes · found there at 1:52 PM')
        .and('contain', 'Also found thanks to the scouting')
      cy.get('[data-testid="recap-scout-others"] li').should('have.length', 13)
      cy.get('[data-testid="recap-scout-others"] li').first().should('contain', 'Rufous-backed Robin').and('contain', 'ABA 3').find('.recap-scout__dot').should('exist')
      cy.get('[data-testid="recap-scout-more"]').should('have.text', '+11 more')
    })
  })
})
