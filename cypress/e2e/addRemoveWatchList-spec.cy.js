import { login } from "../support/login"

describe("Adding to watch list", () => {
    beforeEach(() => {
        login()
    })

    it('should add 2 birds from main screen and they should persist in the saved view', () => {
        cy.get('#rosgoo').should('not.be.checked')
        cy.get('#rosgoo').click()
        cy.wait('@postSaved').its('request.body.speciesCode').should('eq', 'rosgoo')
        cy.get('#rosgoo').should('be.checked')

        cy.get('#swagoo1').should('not.be.checked')
        cy.get('#swagoo1').click()
        cy.wait('@postSaved').its('request.body.speciesCode').should('eq', 'swagoo1')
        cy.get('#swagoo1').should('be.checked')

        cy.get('[href="/saved"] > .nav-img').click()
        cy.url().should('eq', 'http://localhost:3000/saved')
        cy.get('.birds-list').children().should('have.length', 4).each(($child) => {
            cy.wrap($child).find('input[type="checkbox"]').should('be.checked');
        })
    })

    it('should remove 1 bird from main screen and that change should be reflected in the saved view', () => {
        cy.get('#cangoo').should('be.checked')
        cy.get('#cangoo').click()
        cy.wait('@deleteSaved')
        cy.get('#cangoo').should('not.be.checked')

        cy.get('[href="/saved"] > .nav-img').click()
        cy.get('#cangoo').should('not.exist')
        cy.get('.birds-list').children().should('have.length', 1)
    })

    it('should remove 1 bird from saved view and that change should be reflected in the main screen', () => {
        cy.get('[href="/saved"] > .nav-img').click()
        cy.get('#snogoo').should('be.checked')
        cy.get('#snogoo').click()
        cy.wait('@deleteSaved')
        cy.get('#snogoo').should('not.exist')

        cy.get('.text-link').click()
        cy.get('#snogoo').should('not.be.checked')
    })
})
