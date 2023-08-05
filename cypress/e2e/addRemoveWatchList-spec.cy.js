import { intercepts } from "../support/intercepts"
import { initialSetup } from "../support/initialSetup"

describe("Setting a location", () => {
    beforeEach(() => {
        intercepts()
        cy.visit('http://localhost:3000/')
        initialSetup()
    })

    it('should have correct url and initially have no birds saved', () => {
        cy.get('[href="/saved"] > .nav-img').click()
        .url().should('eq', 'http://localhost:3000/saved')
        .get('.birds-list').children().should('have.length', 0)
    })
    
    it('should have 2 birds saved and can remove them from both views', () => {
        cy.get('#snogoo').click()
        .get('#cangoo').click()
        .get('[href="/saved"] > .nav-img').click()
        .get('.birds-list').children().should('have.length', 2)
        .get(':nth-child(1) > .bird-details > :nth-child(1)').should('contain', 'Snow Goose')
        .get(':nth-child(1) > .bird-details > .sci-name').should('contain', '(Anser caerulescens)')
        .get(':nth-child(2) > .bird-details > :nth-child(1)').should('contain', 'Canada Goose')
        .get(':nth-child(2) > .bird-details > .sci-name').should('contain', '(Branta canadensis)')
        .get('#snogoo').click()
        .get('.birds-list').children().should('have.length', 2)
        .get('.text-link').click()
        .get('#snogoo').should('not.be.checked')
        .get('#cangoo').should('be.checked')
        .get('[href="/saved"] > .nav-img').click()
        .get('.birds-list').children().should('have.length', 1)
        .get(':nth-child(1) > .bird-details > :nth-child(1)').should('contain', 'Canada Goose')
        .get(':nth-child(1) > .bird-details > .sci-name').should('contain', '(Branta canadensis)')
        .get('.text-link').click()
        .get('#cangoo').click()
        .get('[href="/saved"] > .nav-img').click()
        .get('.birds-list').children().should('have.length', 0)
    })
})