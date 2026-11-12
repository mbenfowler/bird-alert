import { login } from '../support/login'

describe('An alert arriving with Home open', () => {
  it('brings the bird’s card in first on the Notable tab, pulsing red with how long ago it was reported', () => {
    cy.fixture('recentBirds').then((obs) => {
      const rows = obs.slice(0, 3)
      const bird = rows[2]
      login()
      cy.get('.birds-list .card', { timeout: 15000 })
      // After login's own stub, so this one answers.
      cy.intercept('GET', '**/api/ebird/notable*', { statusCode: 200, body: rows }).as('notable')
      // The service worker tells open pages about a push on this channel.
      cy.window().then((win) => {
        const channel = new win.BroadcastChannel('bird-alert-notifications')
        channel.postMessage({ type: 'push', title: `Rare: ${bird.comName}`, url: `/sighting/${bird.speciesCode}/${bird.subId}` })
        channel.close()
      })
      cy.get('#notable').should('have.attr', 'aria-pressed', 'true')
      cy.get('.alerts-list .alerts-item').first().should('have.attr', 'data-testid', 'fresh-alert')
        .and('have.class', 'is-fresh').and('have.class', 'is-arriving')
        .and('contain', bird.comName).and('contain', 'Reported just now')
      cy.get('[data-testid="fresh-alert"]').should('have.length', 1)
      // Kept for the hour: still there after a reload.
      cy.reload()
      cy.get('#notable').click()
      cy.get('[data-testid="fresh-alert"]').should('contain', 'Reported just now')
    })
  })
})
