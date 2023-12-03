import { login } from '../support/login'

describe("Error handling", () => {
    // describe("Unauthorized 403 UI", () => {
    //     beforeEach(() => {
    //         cy.intercept('https://api.ebird.org/v2/ref/region/list/subnational2/US-GA', {
    //             statusCode: 403
    //         }).as('getExternalRegionsFailure')

    //         login()
    //     })

    //     it('should show error message', () => {
    //         cy.get('[href="/settings"] > .nav-img').click()
    //         .url().should('eq', 'http://localhost:3000/settings')
    //         .get('select').select('GA')
    //         .get('.submit').click()
    //         .get('.error > :nth-child(1)').should('contain', 'Something went wrong!')
    //         .get('.error > :nth-child(2)').should('contain', 'Please return to home and try again')
    //         .get('.text-link').click()
    //         .get('#initText').should('contain', 'Go to settings and set a location')
    //         .get('[href="/settings"] > .nav-img').click()
    //         .get('select').should('have.value', '')
    //     })
    // })

    describe("Not Found 404 UI", () => {
        beforeEach(() => {
            login()
        })

        it('displays proper messaging on invalid', () => {
            cy.visit('http://localhost:3000/nonsense')
        })

        it('displays proper messaging on valid invalid route', () => {
            cy.visit('http://localhost:3000/settings/nonsense')
        })

        afterEach(() => {
            cy.get('#notFound > p').should('contain', "This page doesn't exist")
            cy.get('button').click()
            .url().should('eq', 'http://localhost:3000/')
        })
    })
})
