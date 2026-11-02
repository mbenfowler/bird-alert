import { stubAuth } from '../support/stubs'

const place = (targets) => ({ id: 7, name: 'Chiricahuas', state: 'AZ', location: 'US-AZ-003', range_mi: 30, home_lat: null, home_lng: null, targets, trips: [], seenCount: 0, lifers_scope: 'life' })
const codes = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`)

// Likely lifers: the short list of suggestions (no limit) and the long one the button uses (limit=50).
const open = (targets, lifers) => {
  stubAuth({ loggedIn: true })
  cy.intercept('GET', '**/api/ebird/regions*', { statusCode: 200, body: [{ code: 'US-AZ-003', name: 'Cochise' }] })
  cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/api/saved?kind=place-suggestions*', (req) => {
    const all = req.url.includes('limit=50')
    req.reply({ statusCode: 200, body: { suggestions: (all ? lifers : lifers.slice(0, 3)).map((speciesCode) => ({ speciesCode, comName: speciesCode, days: 1, sampled: 7 })) } })
  }).as('suggestions')
  cy.intercept('GET', '**/api/saved?kind=places*', { statusCode: 200, body: [place(targets)] }).as('getPlaces')
  cy.visit('http://localhost:3000/settings?tab=places')
  cy.wait('@getPlaces')
}

describe('Add every bird I have never seen', () => {
  it('adds every likely lifer not already a target in one tap, and says how many', () => {
    open(['lif001'], codes(23, 'lif'))
    cy.intercept('PUT', '**/api/saved?kind=place-targets&id=7', (req) => req.reply({ statusCode: 200, body: place(req.body.codes) })).as('putTargets')
    cy.contains('.place__add-never-seen', "Add every bird I've never seen (22)").click()
    cy.wait('@putTargets').its('request.body.codes').should((list) => {
      expect(list).to.have.length(23)
      expect(list[0]).to.eq('lif001', 'existing targets stay first')
      expect(new Set(list).size).to.eq(23)
    })
    cy.contains("Added 22 birds you've never seen.")
  })

  it('stops at the 50-target limit', () => {
    open(codes(45, 'old'), codes(20, 'lif'))
    cy.intercept('PUT', '**/api/saved?kind=place-targets&id=7', (req) => req.reply({ statusCode: 200, body: place(req.body.codes) })).as('putTargets')
    cy.contains('.place__add-never-seen', '(5)').click()
    cy.wait('@putTargets').its('request.body.codes').should('have.length', 50)
  })

  it('is hidden when there is nothing new to add', () => {
    open(['lif000'], ['lif000'])
    cy.wait('@suggestions')
    cy.get('.place__add-never-seen').should('not.exist')
  })
})
