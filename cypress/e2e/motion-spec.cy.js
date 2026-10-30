import { login } from '../support/login'
import { stubAuth } from '../support/stubs'

// Nine notable sightings on two days, more than the six an earlier version animated.
const notableRow = (base) => Array.from({ length: 9 }, (_, i) => ({
  ...base,
  subId: `SM${i}`,
  obsDt: i < 3 ? '2026-10-30 09:00' : '2026-10-27 08:00'
}))

const slides = ($a) => expect(getComputedStyle($a[0]).animationName).to.eq('alert-in')

describe('Motion', () => {
  it('alert cards slide in from the right on load, and again when another tab is picked', () => {
    login()
    cy.get('.alerts-list > a', { timeout: 15000 }).first().should(slides)
    cy.intercept('GET', '**/api/ebird/notable*', { fixture: 'notableWeek' })
    cy.get('#notable').click()
    cy.get('.alerts-list > a').first().should(slides)
    cy.get('#star').click()
    cy.get('.alerts-list > a').first().should(slides)
  })

  it('every card in the row sweeps in from off the right edge, not just the first few', () => {
    login()
    cy.get('.alerts-list > a', { timeout: 15000 })
    // After login(), whose own notable stub would otherwise answer first.
    cy.fixture('notableWeek').then((week) => {
      cy.intercept('GET', '**/api/ebird/notable*', { body: notableRow(week[0]) }).as('row')
    })
    cy.get('#notable').click()
    cy.wait('@row')
    cy.get('.alerts-list > a').should('have.length', 9).each(($a) => slides($a))
    // Frozen at its first frame, the whole row is off the right edge, spaced wider than it sits.
    cy.window().then((win) => {
      const cards = [...win.document.querySelectorAll('.alerts-list > a')]
      const anims = cards.map((card) => card.getAnimations().find((a) => a.animationName === 'alert-in'))
      anims.forEach((a) => { a.pause(); a.currentTime = 0 })
      const lefts = cards.map((card) => card.getBoundingClientRect().left)
      expect(lefts[0]).to.be.greaterThan(win.innerWidth, 'the first card starts off screen too')
      anims.forEach((a) => a.finish())
      const settled = cards.map((card) => card.getBoundingClientRect().left)
      expect(settled[0]).to.be.lessThan(40, 'and it ends where it sits')
      expect(lefts[1] - lefts[0]).to.be.greaterThan(settled[1] - settled[0], 'the gaps close as the row comes in')
      expect(anims.every((a) => a.effect.getTiming().delay === 0), 'the whole row moves together').to.eq(true)
    })
  })

  it('sightings since the last visit are marked New; on a first visit nothing is', () => {
    login()
    cy.get('.alerts-list > a', { timeout: 15000 })
    // After login(), whose own notable stub would otherwise answer first.
    cy.fixture('notableWeek').then((week) => {
      cy.intercept('GET', '**/api/ebird/notable*', { body: notableRow(week[0]) }).as('row')
    })
    cy.get('#notable').click()
    cy.wait('@row')
    cy.get('.alert-new').should('not.exist')

    // The last visit ended on Oct 28: the three from Oct 30 are new, the six from Oct 27 are not.
    // Planted as the page loads: leaving the old page saves its own visit end first, as in real use.
    cy.visit('http://localhost:3000/', { onBeforeLoad: (win) => win.localStorage.setItem('lastVisit', String(new Date(2026, 9, 28, 12, 0).getTime())) })
    cy.get('.alerts-list > a', { timeout: 15000 })
    cy.get('#notable').click()
    cy.wait('@row')
    cy.get('.alerts-list > a.is-new').should('have.length', 3)
    cy.get('.alerts-list > a.is-new').first().find('.alert-new').should('contain', 'New')
    cy.get('.alerts-list > a').last().find('.alert-new').should('not.exist')
  })

  it('opening Delete my account sounds the red alert: the siren glow, and the klaxon unless sound is off', () => {
    stubAuth({ loggedIn: true })
    cy.visit('http://localhost:3000/settings', {
      // Sound off for the test run: the glow still comes, and nothing tries to play.
      onBeforeLoad: (win) => win.localStorage.setItem('alertMode', JSON.stringify({ sound: false }))
    })
    cy.contains('button', 'Delete my account').click()
    cy.get('html').should('have.attr', 'data-alarm', 'siren')
    cy.contains('h2', 'Delete your account?')
  })
})
