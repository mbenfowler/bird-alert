import { login } from '../support/login'

describe('Still there? and the Home Screen nudge', () => {
  it('a rarity\'s report says whether it\'s still there, with the drive from your start', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.fixture('where').then((where) => {
      cy.intercept('GET', '**/api/ebird/where?*', { body: { ...where, class: 'rare' } }).as('rareWhere')
    })
    cy.intercept('GET', '**/api/saved?kind=route*', { body: { region: 'US-GA-139', stops: null, start: { locId: null, name: 'Home', lat: 34.3, lng: -83.8 }, updatedAt: null } })
    cy.intercept('GET', '**/api/ebird/drive?*', { body: { minutes: 18, miles: 9.2, geometry: [] } }).as('drive')
    cy.intercept('GET', '**/api/ebird/chase?*', { body: { locId: 'L14136408', speciesCode: 'cangoo', lastSeen: '2023-11-30 13:49', hoursAgo: 4, checkedSince: 2, foundSince: 2, missesSince: 0, stillThere: 92, chance: 81, verdict: 'fresh' } }).as('chase')
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.wait('@chase').its('request.url').should('include', 'locId=L14136408').and('include', 'cls=rare')
    cy.get('.still-there').should('contain', 'Yes, as of the latest checklists').and('contain', '4 hours ago').and('contain', 'It was on all 2 checklists filed here since the report.')
    cy.get('.still-there__chance').should('have.text', 'You have an 81% chance to find it if you go now, 18 minutes from your start.')
  })

  it('a bird that lives here gets no "still there?"', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.intercept('GET', '**/api/ebird/chase?*', cy.spy().as('chaseCalled'))
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sighting__places li').should('have.length', 2)
    cy.get('.still-there').should('not.exist')
    cy.get('@chaseCalled').should('not.have.been.called')
  })

  const asIphone = (win) => Object.defineProperty(win.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })

  it('iPhone Safari is asked once to add the app to the Home Screen, until dismissed', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.visit('http://localhost:3000/', { onBeforeLoad: asIphone })
    cy.get('.install-nudge').should('contain', 'Get alerts on this iPhone').and('contain', 'Add to Home Screen')
    cy.contains('.install-nudge button', 'Got it').click()
    cy.get('.install-nudge').should('not.exist')
    cy.visit('http://localhost:3000/', { onBeforeLoad: asIphone })
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('.install-nudge').should('not.exist')
  })

  it('other browsers never see it', () => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('.install-nudge').should('not.exist')
  })
})
