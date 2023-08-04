import { intercepts } from "../support/intercepts"
import { initialSetup } from "../support/initialSetup"

describe("Setting a location", () => {
  beforeEach(() => {
    intercepts()
    
    cy.visit('http://localhost:3000/')
  })
  
  it("should fetch that location's birds and display them on the main page", () => {
    initialSetup()
  })
})
