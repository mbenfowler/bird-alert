describe("Setting a location", () => {
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
        .get('button').click()
        .get('.error > :nth-child(1)').should('contain', 'Something went wrong!')
        .get('.error > :nth-child(2)').should('contain', 'Please return to home and try again')
        .get('.text-link').click()
        .get('#initText').should('contain', 'Go to settings and set a location')
        .get('[href="/settings"] > .nav-img').click()
        .get('select').should('have.value', '')
    })
})