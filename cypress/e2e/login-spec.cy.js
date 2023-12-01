describe("Login flow", () => {
  beforeEach(() => {
    cy.intercept('http://localhost:3001/api/getAllBirds', {
      statusCode: 200,
      fixture: 'birdCodes'
    }).as('birdCodes')

    cy.intercept('http://localhost:3001/api/getUserExists?email=robinware456@gmail.com', {
      statusCode: 200,
      body: {
        "userExists": true
      }
    }).as('userExists')

    
    cy.visit('http://localhost:3000/')
  })
  
  it("should be able to login", () => {
    cy.get('.input').type('robinware456@gmail.com').type('{enter}')
    cy.wait(1000)

    cy.get(':nth-child(2) > .input').type('1234').type('{enter}')
  })
  
  // it("should have a login form that redirects to the main page", () => {
  //   cy.get('.login-btn').click()
  //   .url().should('eq', 'http://localhost:3000/login')
  //   .get('input[name="email"]').type('')
  // })
})
