export const initialSetup = () => {
    cy.get('[href="/settings"] > .nav-img').click()
    .url().should('eq', 'http://localhost:3000/settings')
    .get('select').select('US-GA-139')
    .get('button').click()
    .get('.text-link').click()
    .url().should('eq', 'http://localhost:3000/')
    .get('.birds-list').children().should('have.length', 5)
    .get(':nth-child(1) > .bird-details > :nth-child(1)').should('contain', 'Snow Goose')
    .get(':nth-child(1) > .bird-details > .sci-name').should('contain', '(Anser caerulescens)')
    .get(':nth-child(5) > .bird-details > :nth-child(1)').should('contain', 'Tundra Swan')
    .get(':nth-child(5) > .bird-details > .sci-name').should('contain', '(Cygnus columbianus)')
}
    