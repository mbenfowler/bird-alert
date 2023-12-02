export const login = () => {
  cy.intercept('http://localhost:3001/api/getAllBirds', {
    statusCode: 200,
    fixture: 'allBirds'
  }).as('allBirds')

  cy.intercept('http://localhost:3001/api/getUserExists?email=robinware456@gmail.com', {
    statusCode: 200,
    body: { "userExists": true }
  }).as('userExists')

  cy.intercept('http://localhost:3001/api/getIsCorrectPass?email=robinware456@gmail.com&password=1234', {
    statusCode: 200,
    body: { "isCorrectPass": true }
  }).as('isCorrectPass')

  cy.intercept('http://localhost:3001/api/getUser?email=robinware456@gmail.com', {
    statusCode: 200,
    body: {
      "id": 1,
      "username": "",
      "password": "1234",
      "email": "robinware456@gmail.com",
      "phone": "555-555-5556",
      "location": "US-GA-139",
      "state": "GA",
      "created_at": "2023-11-21T19:33:34.829Z",
      "updated_at": "2023-12-01T23:13:41.118Z"
    }
  }).as('getUser')

  cy.intercept('http://localhost:3001/api/getSaved?user_id=1', {
    statusCode: 200,
    fixture: 'savedBirds'
  }).as('getSaved')

  cy.intercept('https://api.ebird.org/v2/product/spplist/US-GA-139', {
    statusCode: 200,
    fixture: 'birdCodes'
  }).as('birdCodes')

  cy.intercept('https://api.ebird.org/v2/data/obs/US-GA-139/recent', {
    statusCode: 200,
    fixture: 'recentBirds'
  }).as('recentBirds')

  cy.fixture('birdCodes').then((birdCodes) => {
    birdCodes.forEach((code) => {
      cy.intercept(`http://localhost:3001/api/getBird?speciesCode=${code}`, {
        statusCode: 200,
        fixture: `${code}`
      }).as(`${code}GetInternalBird`)

      cy.intercept(`http://localhost:3001/api/getSavedSpeciesCode?speciesCode=${code}&user_id=1`, {
        statusCode: 200,
        body: code === 'cangoo' || code === 'snogoo' ? true : false
      })
    })
  })

  cy.visit('http://localhost:3000/')
}
