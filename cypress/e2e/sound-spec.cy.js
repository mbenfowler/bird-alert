import { login } from '../support/login'

describe('Bird sounds', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('a card plays its recording on tap and shows the credit', () => {
    cy.get('#cangoo').closest('.card').find('.sound__round').as('play')
    cy.get('@play').should('have.attr', 'aria-label', 'Hear a Canada Goose')
    cy.get('@play').click()
    cy.wait('@sound').its('request.url').should('include', 'code=cangoo')
    cy.get('@play').should('have.attr', 'data-state').and('match', /playing|idle/)
    cy.get('#cangoo').closest('.card').find('.sound-credit').should('contain', 'XC4242').and('contain', 'A Birder').and('contain', 'CC BY-NC-SA 4.0')
    cy.get('#cangoo').closest('.card').find('.sound-credit a').should('have.attr', 'href', 'https://xeno-canto.org/4242')
  })

  it('the species page offers the same recording as a pill', () => {
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.get('.sound__pill').should('contain', 'Hear it').click()
    cy.wait('@sound')
    cy.get('.sighting__hero .sound-credit').should('contain', 'XC4242')
  })
})
