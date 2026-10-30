import { login } from '../support/login'

describe('Polish', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('a star going on the watch list bounces and throws sparks', () => {
    // The sparks last half a second, quicker than a slow CI machine gets round to looking, so
    // note each burst as it's added rather than hunting for it afterwards.
    cy.window().then((win) => {
      win.__bursts = []
      new win.MutationObserver((changes) => changes.forEach((c) => c.addedNodes.forEach((n) => {
        if (n.classList?.contains('pop-burst')) win.__bursts.push(n.className)
      }))).observe(win.document.body, { childList: true })
    })
    cy.get('#snogoo').click()
    cy.window().its('__bursts').should('deep.equal', ['pop-burst pop-burst--sparks'])
    // The sparks land and their layer clears itself away, and the star's mark with it.
    cy.get('.pop-burst', { timeout: 4000 }).should('not.exist')
    cy.get('#snogoo').should('not.have.class', 'is-popping')
  })

  it('cards load behind skeletons shaped like them, which give way to the birds', () => {
    cy.intercept('GET', '**/api/birds?codes=*', (req) => {
      req.reply({ delay: 1500, statusCode: 200, body: [] })
    }).as('slowBirds')
    cy.clearLocalStorage()
    cy.visit('http://localhost:3000/')
    cy.get('.skeleton-list').should('have.attr', 'aria-busy', 'true').and('contain', 'Loading birds')
    cy.get('.skeleton-list .card.skeleton').first().within(() => {
      cy.get('.skeleton__img')
      cy.get('.skeleton__line').should('have.length', 3)
      cy.get('.skeleton__dot').should('have.length', 3)
    })
    cy.wait('@slowBirds')
    cy.get('.skeleton-list').should('not.exist')
  })

  it('a bird going on the life list is a lifer: feathers and a banner', () => {
    cy.window().then((win) => {
      win.__bursts = []
      new win.MutationObserver((changes) => changes.forEach((c) => c.addedNodes.forEach((n) => {
        if (n.classList?.contains('pop-burst')) win.__bursts.push(`${n.className} ${n.children.length}`)
      }))).observe(win.document.body, { childList: true })
    })
    cy.get('#seen-snogoo').click()
    cy.window().its('__bursts').should('deep.equal', ['pop-burst pop-burst--feathers 12'])
    cy.contains('.lifer-toast', 'Lifer! Snow Goose').should('exist')
  })
})
