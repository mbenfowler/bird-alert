export const intercepts = () => {
    cy.intercept('https://api.ebird.org/v2/product/spplist/US-GA-139', {
      statusCode: 200,
      fixture: 'birdCodes'
    })

    cy.intercept('https://api.ebird.org/v2/ref/taxonomy/ebird?species=snogoo&fmt=json', {
      statusCode: 200,
      fixture: 'snowGoose'
    })

    cy.intercept('https://api.ebird.org/v2/ref/taxonomy/ebird?species=rosgoo&fmt=json', {
      statusCode: 200,
      fixture: 'rossGoose'
    })

    cy.intercept('https://api.ebird.org/v2/ref/taxonomy/ebird?species=swagoo1&fmt=json', {
      statusCode: 200,
      fixture: 'swanGoose'
    })

    cy.intercept('https://api.ebird.org/v2/ref/taxonomy/ebird?species=cangoo&fmt=json', {
      statusCode: 200,
      fixture: 'canadaGoose'
    })

    cy.intercept('https://api.ebird.org/v2/ref/taxonomy/ebird?species=tunswa&fmt=json', {
      statusCode: 200,
      fixture: 'tundraSwan'
    })
}
