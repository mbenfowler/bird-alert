import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

// A page wider than the viewport is what lets phones zoom out and scroll sideways. None may be.
const assertNoHorizontalOverflow = () => {
  cy.document().its('documentElement').then((html) => {
    expect(html.scrollWidth, 'document width').to.be.at.most(html.clientWidth)
  })
}

describe('Phone-width layout', () => {
  beforeEach(() => cy.viewport(390, 844))

  it('the wordmark is never plain black: gradient until the colour font has loaded', () => {
    stubAuth()
    cy.visit('http://localhost:3000/')
    cy.get('#titleAlert').should(($el) => {
      const cs = getComputedStyle($el[0])
      // The app's document, not the spec's: the class is set on the page under test.
      const colourFont = $el[0].ownerDocument.documentElement.classList.contains('has-colour-font')
      if (colourFont) expect(cs.fontFamily, 'colour font in use').to.match(/Bungee Spice/)
      else expect(cs.webkitTextFillColor, 'gradient fallback').to.eq('rgba(0, 0, 0, 0)')
    })
  })

  it('on a phone the Settings and Logout labels are not shown over the icons', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('#settingsActions').should('not.be.visible')
    cy.get('.nav-icon--settings').should('be.visible')
  })

  it('the forgotten-password link is a clear button once the email is known', () => {
    stubAuth()
    cy.visit('http://localhost:3000/login')
    cy.get('.input.email').type('robinware456@gmail.com{enter}')
    cy.get('.login-forgot').should('contain', 'Forgot your password?')
    cy.get('.login-forgot__button').should('be.visible').and('have.text', 'Email me a reset link').click()
    cy.wait('@forgot')
  })

  it('login does not overflow', () => {
    stubAuth()
    cy.visit('http://localhost:3000/login')
    cy.get('.input.email')
    assertNoHorizontalOverflow()
  })

  it('the splash page does not overflow, and its pickers leave room for their arrows', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/notable*', { fixture: 'notableWeek' })
    cy.intercept('GET', '**/api/ebird/observations*', { fixture: 'notableWeek' })
    cy.intercept('GET', '**/api/birds?*', { statusCode: 200, body: [] })
    cy.visit('http://localhost:3000/')
    cy.get('.landing__bird').should('have.length', 2)
    assertNoHorizontalOverflow()
    cy.get('.landing__pickers select').each(($s) => {
      expect(parseFloat(getComputedStyle($s[0]).paddingRight)).to.be.at.least(32)
    })
  })

  it('a new page starts at the top and each alert tab starts at its first card', () => {
    login()
    cy.get('.birds-list .card').should('have.length', 7)
    cy.get('#alertsList').scrollTo('right', { ensureScrollable: false })
    cy.get('#notable').click()
    cy.get('#alertsList').should(($list) => expect($list[0].scrollLeft, 'alerts row scroll').to.eq(0))
    cy.scrollTo('bottom', { ensureScrollable: false })
    cy.window().its('scrollY').should('be.gt', 0)
    cy.get('[href="/saved"]').click()
    cy.contains('.list-heading', 'Birds on your watch list', { timeout: 15000 })
    cy.window().its('scrollY').should('eq', 0)
  })

  it('home, saved and settings do not overflow and the watch toggle is reachable', () => {
    login()
    cy.get('.birds-list .card').should('have.length', 7)
    assertNoHorizontalOverflow()
    cy.get('#rosgoo').should('be.visible')
    cy.get('[href="/saved"]').click()
    cy.contains('.list-heading', 'Birds on your watch list', { timeout: 15000 })
    cy.get('.birds-list .card')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/settings')
    cy.get('#settings-form')
    assertNoHorizontalOverflow()
    // A species page with real-world place names: long, unbreakable, with no-wrap times beside them.
    cy.fixture('recentBirds').then((obs) => {
      const first = obs.find((o) => o.subId === 'S155544243')
      const long = { ...first, subId: 'S155544998', locName: 'Lake Lanier--Olympic Rowing Venue (Clarks Bridge Park, north shore boat ramp)', howMany: 1200 }
      cy.intercept('GET', '**/api/ebird/species-observations*', { statusCode: 200, body: [long, first] }).as('longNames')
    })
    cy.visit('http://localhost:3000/sighting/cangoo/S155544998')
    cy.get('.sighting__title h1')
    cy.get('.sighting__meta').should('contain', 'Olympic Rowing')
    assertNoHorizontalOverflow()
    cy.get('.sighting__frame').then(($f) => expect($f[0].getBoundingClientRect().right, 'frame right edge').to.be.at.most(390))
    cy.scrollTo('bottom')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/map')
    cy.get('.sightings-map')
    assertNoHorizontalOverflow()
    cy.visit('http://localhost:3000/sightings?s=cangoo:S155544243,tuftit:S155544243')
    cy.get('.alert-sightings__table')
    assertNoHorizontalOverflow()
  })

  it('shows every alerts tab title in full', () => {
    login()
    cy.get('.birds-list .card')
    for (const [tab, title] of [['star', 'Watch list sightings'], ['notable', 'Notable sightings'], ['arriving', 'Arriving soon']]) {
      cy.get(`#${tab}`).click()
      cy.get('.alerts-title').should('have.text', title).then(($el) => {
        expect($el[0].scrollWidth, `${title} fits`).to.be.at.most($el[0].clientWidth)
      })
    }
    assertNoHorizontalOverflow()
  })
})
