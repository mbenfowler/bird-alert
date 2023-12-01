describe("Error handling", () => {
    describe("Unauthorized 403 UI", () => {
        beforeEach(() => {
            cy.intercept('https://api.ebird.org/v2/product/spplist/US-GA-139', {
                statusCode: 403,
            })

            cy.visit('http://localhost:3000/')
        })

        it('should show error message', () => {
            cy.get('[href="/settings"] > .nav-img').click()
            .url().should('eq', 'http://localhost:3000/settings')
            .get('select').select('US-GA-139')
            .get('form > a').click()
            .get('.error > :nth-child(1)').should('contain', 'Something went wrong!')
            .get('.error > :nth-child(2)').should('contain', 'Please return to home and try again')
            .get('.text-link').click()
            .get('#initText').should('contain', 'Go to settings and set a location')
            .get('[href="/settings"] > .nav-img').click()
            .get('select').should('have.value', '')
        })
    })

    describe("Not Found 404 UI", () => {
        it('displays proper messaging on invalid', () => {
            cy.visit('http://localhost:3000/nonsense')
        })

        it('displays proper messaging on valid invalid route', () => {
            cy.visit('http://localhost:3000/settings/nonsense')
        })

        afterEach(() => {
            cy.get('#notFound > p').should('contain', "This page doesn't exist")
            .get('#notFound > a > button').click()
            .url().should('eq', 'http://localhost:3000/')
        })
    })
})
