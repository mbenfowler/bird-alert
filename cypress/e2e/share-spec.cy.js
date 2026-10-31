import { login } from '../support/login'

const shareReply = { statusCode: 201, body: { id: 'abc123defg', url: 'https://bird-alert.vercel.app/share/s/abc123defg' } }

describe('Sharing a sighting', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.intercept('POST', '**/api/saved?kind=share', shareReply).as('share')
  })

  it('an alert card shares its sighting in one tap, copying the link where there is no share sheet', () => {
    cy.window().then((win) => { cy.stub(win.navigator.clipboard, 'writeText').resolves().as('copy') })
    cy.get('.alerts-list .alerts-item--sighting').first().find('.alert-share')
      .should('have.attr', 'aria-label', 'Share this Canada Goose sighting')
      .click()
    cy.wait('@share').its('request.body').should('deep.include', {
      kind: 'sighting', speciesCode: 'cangoo', subId: 'S155544243', locName: "Rusty's Gainesville Yard"
    })
    cy.get('@copy').should('have.been.calledOnceWith', 'http://localhost:3000/share/s/abc123defg')
    cy.contains('Link copied. Paste it anywhere.')
    // Sharing doesn't open the sighting; tapping the card still does.
    cy.location('pathname').should('eq', '/')
    cy.get('.alerts-list .alert-link').first().click()
    cy.location('pathname').should('eq', '/sighting/cangoo/S155544243')
    // And the sighting page says plainly what its button does.
    cy.contains('button.pill-button', 'Share sighting').find('svg').should('exist')
  })

  it('on a phone, the share sheet opens instead', () => {
    cy.window().then((win) => {
      win.navigator.share = cy.stub().resolves().as('sheet')
      const real = win.matchMedia.bind(win)
      cy.stub(win, 'matchMedia').callsFake((query) => (query === '(pointer: coarse)' ? { ...real(query), matches: true, media: query } : real(query)))
    })
    cy.get('.alerts-list .alerts-item--sighting').first().find('.alert-share').click()
    cy.wait('@share')
    cy.get('@sheet').should('have.been.calledOnceWith', { title: "Canada Goose at Rusty's Gainesville Yard", url: 'http://localhost:3000/share/s/abc123defg' })
    cy.location('pathname').should('eq', '/')
  })

  it('an arriving-soon card has nothing to share', () => {
    cy.get('#arriving').click()
    cy.get('.alerts-list .alerts-item').should('exist')
    cy.get('.alerts-list .alert-share').should('not.exist')
  })
})
