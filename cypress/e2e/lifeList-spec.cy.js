import { login } from '../support/login'

describe('Life list', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  })

  it('a card’s tick puts a bird on the life list and takes it off again', () => {
    cy.get('#seen-snogoo').should('not.be.checked').click()
    cy.wait('@postSeen').its('request.body').should('deep.equal', { speciesCode: 'snogoo' })
    cy.get('#seen-snogoo').should('be.checked')
    cy.contains('.lifer-toast', 'Lifer! Snow Goose').should('exist')
    cy.get('#seen-snogoo').click()
    cy.wait('@deleteSeen').its('request.url').should('include', 'speciesCode=snogoo')
    cy.get('#seen-snogoo').should('not.be.checked')
  })

  it('settings imports an eBird life list and lets the person settle the rows it could not', () => {
    // Lifer alerts (Alerts tab) wait for a life list of 10; the list itself is on the Account tab.
    cy.visit('http://localhost:3000/settings?tab=alerts')
    cy.contains('.notification__hint', 'Needs 10 or more birds').should('exist')
    cy.contains('.settings-tabs button', 'Account').click()
    cy.get('.life-list__count').should('have.text', 'No birds yet')
    cy.contains('summary', 'Start from your eBird life list').click()
    cy.get('#lifeListFile').selectFile({ contents: Cypress.Buffer.from('Category,Common Name,Scientific Name\nspecies,Snow Goose,Anser caerulescens\n'), fileName: 'ebird_world_life_list.csv', mimeType: 'text/csv' }, { force: true })
    cy.wait('@importLifeList').its('request.body.csv').should('include', 'Snow Goose')
    cy.get('.life-list__result').should('contain', 'Added 12 birds').and('contain', 'Your life list has 12').and('contain', '3 rows were left out')
    // Not sure which vireo: local reports lean Western, and one tap takes the suggestion.
    cy.contains('.life-list__result li', 'Eastern/Western Warbling Vireo').within(() => {
      cy.contains('button', 'Not sure? Check local reports').click()
      cy.contains('Probably Western Warbling Vireo').should('exist')
      cy.contains('Hall County').should('exist')
      cy.contains('Western Warbling Vireo on 9, Eastern Warbling Vireo on 2').should('exist')
      cy.contains('button', 'Mark Western Warbling Vireo').click()
    })
    cy.wait('@splitEvidence').its('request.body').should('deep.include', { locId: 'L342269', day: '2024-05-25' })
    cy.wait('@postSeen').its('request.body').should('deep.equal', { speciesCode: 'wewvir2' })
    cy.contains('.life-list__result li', 'Eastern/Western Warbling Vireo').should('contain', '✓ Western Warbling Vireo added')
    cy.get('.life-list__count').should('have.text', '13 birds') // twelve imported, and the vireo picked above
    // A pre-split sighting: pick which species it was.
    cy.contains('.life-list__result li', 'Saltmarsh/Prairie Willet').within(() => {
      cy.contains('Which did you see?')
      // Local reports can't say here; the person can still choose.
      cy.contains('button', 'Not sure? Check local reports').click()
      cy.contains('Too few identified reports to say').should('exist')
      cy.contains('button', 'Mark').should('not.exist')
      cy.contains('button', 'Saltmarsh Willet').click()
    })
    cy.wait('@postSeen').its('request.body').should('deep.equal', { speciesCode: 'willet2' })
    cy.contains('.life-list__result li', 'Saltmarsh/Prairie Willet').should('contain', '✓ Saltmarsh Willet added')
    cy.contains('.life-list__result li', 'Muscovy Duck').find('button').should('have.text', 'Count it anyway')
    cy.contains('.settings-tabs button', 'Alert Center').click()
    cy.contains('h2', 'Alert center')
    cy.contains('.notification__hint', 'Needs 10 or more birds').should('not.exist')
  })

  it('the watch list can hide birds already seen', () => {
    cy.get('#seen-snogoo').click()
    cy.wait('@postSeen')
    cy.visit('http://localhost:3000/saved')
    cy.get('.birds-list .card').then(($cards) => {
      const all = $cards.length
      cy.contains('.list-filter', 'Hide the 1 I’ve seen').find('input').click()
      cy.get('.birds-list .card').should('have.length', all - 1)
      cy.get('#seen-snogoo').should('not.exist')
      cy.get('.list-end').should('contain', 'you haven’t seen yet')
    })
  })

  it('where to go can rank places by lifers: the county’s birds not on the life list', () => {
    cy.get('#seen-snogoo').click()
    cy.wait('@postSeen')
    cy.visit('http://localhost:3000/go')
    cy.wait('@whereToGo')
    cy.contains('.go__mode', 'Lifers first').find('input').should('not.be.checked').click()
    cy.wait('@whereToGo').its('request.url').then((url) => {
      const codes = new URL(url).searchParams.get('codes').split(',')
      expect(codes).to.include('cangoo')
      expect(codes).not.to.include('snogoo')
      expect(codes).to.include('mutswa', 'county birds beyond the watch list count too')
    })
    cy.get('.go__summary').should('contain', 'possible lifer')
  })

  it('the life list page shows, sorts, searches and takes birds off, with an undo', () => {
    cy.get('#seen-snogoo').click()
    cy.wait('@postSeen')
    cy.get('#seen-cangoo').click()
    cy.wait('@postSeen')
    cy.visit('http://localhost:3000/saved')
    cy.contains('.list-tabs__tab', 'Life list (2)').click()
    cy.url().should('include', '/life-list')
    cy.get('.list-heading').should('contain', 'Your life list: 2 birds')
    // Newest first: the goose ticked second leads, and the card says when it went on the list.
    cy.get('.birds-list .card').should('have.length', 2).first().should('contain', 'Canada Goose').and('contain', 'First seen')
    cy.get('.life-page__sort select').select('A to Z')
    cy.get('.birds-list .card').first().should('contain', 'Canada Goose')
    cy.get('.life-page__search input').type('snow')
    cy.get('.birds-list .card').should('have.length', 1).and('contain', 'Snow Goose')
    cy.get('.life-page__search input').clear()
    cy.get('.birds-list .card').should('have.length', 2)
    // Off the list, and back with the toast's Undo.
    cy.get('#seen-snogoo').click()
    cy.wait('@deleteSeen')
    cy.get('.birds-list .card').should('have.length', 1)
    cy.contains('.toast-undo', 'Removed Snow Goose from your life list').find('button').click()
    cy.wait('@postSeen').its('request.body').should('deep.equal', { speciesCode: 'snogoo' })
    cy.get('.birds-list .card').should('have.length', 2)
  })
})
