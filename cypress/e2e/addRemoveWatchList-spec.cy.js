import { login } from "../support/login"

describe("Adding to watch list", () => {
    beforeEach(() => {
        login()
    })

    // it('should have correct url and initially have no birds saved', () => {
    //     cy.get('[href="/saved"] > .nav-img').click()
    //     .url().should('eq', 'http://localhost:3000/saved')
    //     .get('.birds-list').children().should('have.length', 0)
    // })
    
    it('should add 2 birds from main screen and they should persist in the saved view', () => {
        cy.intercept('http://localhost:3001/api/postSaved?comName=Ross%27s+Goose&sciName=Anser+rossii&speciesCode=rosgoo&category=species&order=Anseriformes&familyCode=anatid1&familyComName=Ducks%2C+Geese%2C+and+Waterfowl&familySciName=Anatidae&birdImg=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1634506264722-0d6e457efc16%3Fq%3D75%26fm%3Djpg%26w%3D400%26fit%3Dmax&wikiURL=https%3A%2F%2Fen.wikipedia.org%2F%3Fcurid%3D539045&taxonOrder=256&user_id=1', {
            statusCode: 200,
            fixture: 'rosgoo.json'
        }).as('postSaved1')

        cy.intercept('http://localhost:3001/api/postSaved?comName=Swan+Goose&sciName=Anser+cygnoides&speciesCode=swagoo1&category=species&order=Anseriformes&familyCode=anatid1&familyComName=Ducks%2C+Geese%2C+and+Waterfowl&familySciName=Anatidae&birdImg=undefined&wikiURL=https%3A%2F%2Fen.wikipedia.org%2F%3Fcurid%3D430368&taxonOrder=264&user_id=1', {
            statusCode: 200,
            fixture: 'swagoo1.json'
        }).as('postSaved2')

        cy.get('#rosgoo').should('not.be.checked').click()
        .get('#swagoo1').should('not.be.checked').click()
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
              }).as(`${code}GetSavedSpeciesCode`)
            })
        })
        .get('[href="/saved"] > .nav-img').click()
        .url().should('eq', 'http://localhost:3000/saved')
        .get('.birds-list').children().should('have.length', 4).each(($child) => {
            cy.wrap($child).find('input[type="checkbox"]').should('be.checked');
        })
    })

    it('should remove 1 bird from main screen and that change should be reflected in the saved view', () => {
        cy.intercept('http://localhost:3001/api/deleteSaved?speciesCode=cangoo&user_id=1', {
            statusCode: 200,
            fixture: 'cangoo.json'
        }).as('deleteSaved1')

        cy.get('#cangoo').should('be.checked').click()
        cy.intercept('http://localhost:3001/api/getSaved?user_id=1',{
            statusCode: 200,
            fixture: 'savedBirds3.json'
        }).as('getSaved3')
        .get('[href="/saved"] > .nav-img').click()
        .get('#cangoo').should('not.exist')
        .get('.birds-list').children().should('have.length', 1)
    })
})
