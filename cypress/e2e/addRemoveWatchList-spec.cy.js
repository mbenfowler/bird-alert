import { login } from "../support/login"

describe("Adding to watch list", () => {
    beforeEach(() => {
        cy.intercept('http://localhost:3001/api/postSaved?comName=Ross%27s+Goose&sciName=Anser+rossii&speciesCode=rosgoo&category=species&order=Anseriformes&familyCode=anatid1&familyComName=Ducks%2C+Geese%2C+and+Waterfowl&familySciName=Anatidae&birdImg=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1634506264722-0d6e457efc16%3Fq%3D75%26fm%3Djpg%26w%3D400%26fit%3Dmax&wikiURL=https%3A%2F%2Fen.wikipedia.org%2F%3Fcurid%3D539045&taxonOrder=256&user_id=1', {
            statusCode: 200,
            fixture: 'rosgoo.json'
        }).as('postSaved1')

        cy.intercept('http://localhost:3001/api/postSaved?comName=Swan+Goose&sciName=Anser+cygnoides&speciesCode=swagoo1&category=species&order=Anseriformes&familyCode=anatid1&familyComName=Ducks%2C+Geese%2C+and+Waterfowl&familySciName=Anatidae&birdImg=undefined&wikiURL=https%3A%2F%2Fen.wikipedia.org%2F%3Fcurid%3D430368&taxonOrder=264&user_id=1', {
            statusCode: 200,
            fixture: 'swagoo1.json'
        }).as('postSaved2')

        login()
    })

    // it('should have correct url and initially have no birds saved', () => {
    //     cy.get('[href="/saved"] > .nav-img').click()
    //     .url().should('eq', 'http://localhost:3000/saved')
    //     .get('.birds-list').children().should('have.length', 0)
    // })
    
    it('should have 2 birds saved and can remove them from both views', () => {
        cy.get('#rosgoo').should('not.be.checked').click().should('be.checked')
        .get('#swagoo1').should('not.be.checked').click().should('be.checked')
        cy.intercept('http://localhost:3001/api/getSaved?user_id=1',{
            statusCode: 200,
            fixture: 'savedBirds2.json'
        }).as('getSaved2')
        cy.fixture('birdCodes').then((birdCodes) => {
            birdCodes.forEach((code) => {
              cy.intercept(`http://localhost:3001/api/getBird?speciesCode=${code}`, {
                statusCode: 200,
                fixture: `${code}`
              }).as(`${code}GetInternalBird`)
        
              cy.intercept(`http://localhost:3001/api/getSavedSpeciesCode?speciesCode=${code}&user_id=1`, {
                statusCode: 200,
                body: true
              })
            })
        })
        .get('[href="/saved"] > .nav-img').click()
        .url().should('eq', 'http://localhost:3000/saved')
        .get('.birds-list').children().should('have.length', 4).each(($child) => {
            cy.wrap($child).find('input[type="checkbox"]').should('be.checked');
        })
        // .get('#snogoo').click()
        // .get('.birds-list').children().should('have.length', 2)
        // .get('.text-link').click()
        // .get('#snogoo').should('not.be.checked')
        // .get('#cangoo').should('be.checked')
        // .get('[href="/saved"] > .nav-img').click()
        // .get('.birds-list').children().should('have.length', 1)
        // .get(':nth-child(1) > .bird-details > :nth-child(1)').should('contain', 'Canada Goose')
        // .get(':nth-child(1) > .bird-details > .sci-name').should('contain', '(Branta canadensis)')
        // .get('.text-link').click()
        // .get('#cangoo').click()
        // .get('[href="/saved"] > .nav-img').click()
        // .get('.birds-list').children().should('have.length', 0)
    })
})
