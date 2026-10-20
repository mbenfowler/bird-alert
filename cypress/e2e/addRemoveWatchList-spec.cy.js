import { login } from "../support/login"

describe("Adding to watch list", () => {
    beforeEach(() => {
        login()
    })

    it('should add 2 birds from main screen and they should persist in the saved view', () => {
        cy.intercept('POST', '**/api/saved', (req) => {
            req.reply({ statusCode: 201, body: { id: 999, ...req.body } })
        }).as('postSaved')

        cy.get('#rosgoo').should('not.be.checked').click()
        cy.wait('@postSaved').its('request.body.speciesCode').should('eq', 'rosgoo')
        cy.get('#swagoo1').should('not.be.checked').click()
        cy.wait('@postSaved').its('request.body.speciesCode').should('eq', 'swagoo1')

        cy.intercept('GET', '**/api/saved', { statusCode: 200, fixture: 'savedBirds2.json' }).as('getSaved2')
        cy.get('[href="/saved"] > .nav-img').click()
        .url().should('eq', 'http://localhost:3000/saved')
        .get('.birds-list').children().should('have.length', 4).each(($child) => {
            cy.wrap($child).find('input[type="checkbox"]').should('be.checked');
        })
    })

    it('should remove 1 bird from main screen and that change should be reflected in the saved view', () => {
        cy.intercept('DELETE', '**/api/saved?speciesCode=cangoo', { statusCode: 204, body: '' }).as('deleteSaved')

        cy.get('#cangoo').should('be.checked').click()
        cy.wait('@deleteSaved')

        cy.intercept('GET', '**/api/saved', { statusCode: 200, fixture: 'savedBirds3.json' }).as('getSaved3')
        cy.get('[href="/saved"] > .nav-img').click()
        .get('#cangoo').should('not.exist')
        .get('.birds-list').children().should('have.length', 1)
    })

    it('should remove 1 bird from saved view and that change should be reflected in the main screen', () => {
        cy.intercept('DELETE', '**/api/saved?speciesCode=snogoo', { statusCode: 204, body: '' }).as('deleteSaved')

        cy.get('[href="/saved"] > .nav-img').click()
        .get('#snogoo').should('be.checked').click()
        cy.wait('@deleteSaved')
        cy.get('.text-link').click()
        .get('#snogoo').should('not.be.checked')
    })
})
