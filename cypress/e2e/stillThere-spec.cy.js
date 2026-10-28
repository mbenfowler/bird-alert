import { login } from '../support/login'

describe('Still there? and the Home Screen nudge', () => {
  const chaseFor = (cls, chase, extraStubs = () => {}) => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    extraStubs()
    cy.fixture('where').then((where) => {
      cy.intercept('GET', '**/api/ebird/where?*', { body: { ...where, class: cls } })
    })
    cy.intercept('GET', '**/api/ebird/chase?*', { body: { locId: 'L14136408', speciesCode: 'cangoo', stillThere: 50, chance: 30, verdict: 'maybe', ...chase } }).as('chase')
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.wait('@chase')
  }

  it('a rarity\'s report says what the checklists since show, with the place\'s one tested chance and the drive', () => {
    chaseFor('rare', { lastSeen: '2023-11-30 13:49', hoursAgo: 4, checkedSince: 2, foundSince: 2, missesSince: 0, verdict: 'fresh' }, () => {
      cy.intercept('GET', '**/api/saved?kind=route*', { body: { region: 'US-GA-139', stops: null, start: { locId: null, name: 'Home', lat: 34.3, lng: -83.8 }, updatedAt: null } })
      cy.intercept('GET', '**/api/ebird/drive?*', { body: { minutes: 18, miles: 9.2, geometry: [] } }).as('drive')
    })
    cy.get('@chase').its('request.url').should('include', 'locId=L14136408').and('include', 'cls=rare')
    cy.get('.still-there__verdict').should('have.text', 'Seen on the latest checklists')
    cy.get('.still-there__detail').should('contain', '4 hours ago').and('contain', 'It was on all 2 checklists filed here since the report.')
    // One number only, the where-to-find chance for this place (86% in the fixture), never a second estimate.
    cy.get('.still-there__chance').should('have.length', 1).and('have.text', 'You have an 86% chance to find one here if you go now, 18 minutes from your start.')
  })

  it('one quiet checklist says just that, not "probably gone"', () => {
    chaseFor('passage', { lastSeen: '2023-11-27 13:17', hoursAgo: 72, checkedSince: 1, foundSince: 0, missesSince: 1, verdict: 'gone' })
    cy.get('.still-there__verdict').should('have.text', 'Not on the last checklist')
    cy.get('.still-there__detail').should('contain', '3 days ago').and('contain', '1 checklist since didn’t have it.')
    cy.get('.still-there__chance').should('have.text', 'You have an 86% chance to find one here if you go now.')
  })

  it('three checklists in a row without it reads as probably gone', () => {
    chaseFor('rare', { lastSeen: '2023-11-21 08:25', hoursAgo: 170, checkedSince: 3, foundSince: 0, missesSince: 3, verdict: 'gone' })
    cy.get('.still-there__verdict').should('have.text', 'Probably gone')
    cy.get('.still-there__detail').should('contain', '7 days ago').and('contain', '3 checklists since didn’t have it.')
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
