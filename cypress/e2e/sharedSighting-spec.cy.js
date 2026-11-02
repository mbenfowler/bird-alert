import { stubAuth } from '../support/stubs'

const owl = {
  id: 'owl1234567', kind: 'sighting', createdAt: '2026-11-01T23:17:00Z', speciesCode: 'motowl', comName: 'Mottled Owl', sciName: 'Strix virgata', birdImg: '/images/bird.png',
  locId: 'L1', locName: 'Santa Margarita Ranch (LTC 079) (restricted access)', lat: 26.48, lng: -98.93, obsDt: '2026-10-31 18:25', howMany: 1, subId: 'S407364127', regionName: 'Texas', aba: 5
}
const bunting = { ...owl, id: 'pb12345678', speciesCode: 'paibun', comName: 'Painted Bunting', locName: 'Chicopee Lake', locId: null, aba: null }
const serve = (share) => cy.intercept('GET', `**/api/ebird/share?id=${share.id}`, { body: share })

describe('A shared sighting', () => {
  it('a visitor without the app can pass it on, sees what Bird Alert is near the top, and a word on access', () => {
    stubAuth()
    serve(owl)
    cy.visit('http://localhost:3000/share/s/owl1234567')
    cy.contains('h1', 'Mottled Owl')
    cy.get('.shared__restricted').should('contain', 'Restricted access: this spot is private or by arrangement.')
    cy.get('.shared__pitch').should('contain', 'Bird Alert sends alerts like this the moment a rare bird is reported near you. Free, no ads.')
      .contains('a', 'Get alerts for my area').should('have.attr', 'href', '/login')
    cy.get('.shared__invite').should('exist')
    cy.contains('a', 'Open in Bird Alert').should('not.exist')
    // No share sheet on a computer: the page's own link is copied.
    cy.window().then((win) => { cy.stub(win.navigator.clipboard, 'writeText').resolves().as('copy') })
    cy.contains('.shared__actions button', 'Share').click()
    cy.get('@copy').should('have.been.calledOnceWith', 'http://localhost:3000/share/s/owl1234567')
    cy.contains('Link copied. Paste it anywhere.')
  })

  it('on a phone the share sheet opens with the bird and the place', () => {
    stubAuth()
    serve(bunting)
    cy.visit('http://localhost:3000/share/s/pb12345678', {
      onBeforeLoad: (win) => {
        win.navigator.share = cy.stub().resolves().as('sheet')
        const real = win.matchMedia.bind(win)
        cy.stub(win, 'matchMedia').callsFake((query) => (query === '(pointer: coarse)' ? { ...real(query), matches: true, media: query } : real(query)))
      }
    })
    cy.contains('.shared__actions button', 'Share').click()
    cy.get('@sheet').should('have.been.calledOnceWith', { title: 'Painted Bunting at Chicopee Lake', url: 'http://localhost:3000/share/s/pb12345678' })
    // An ordinary place gets no access warning.
    cy.get('.shared__restricted').should('not.exist')
  })

  it('someone signed in can share it too, and open it in the app, without the sign-up pitch', () => {
    stubAuth({ loggedIn: true })
    serve(owl)
    cy.visit('http://localhost:3000/share/s/owl1234567')
    cy.contains('h1', 'Mottled Owl')
    cy.contains('.shared__actions button', 'Share')
    cy.contains('a', 'Open in Bird Alert').should('have.attr', 'href', '/sighting/motowl/S407364127')
    cy.get('.shared__pitch').should('not.exist')
    cy.get('.shared__invite').should('not.exist')
  })
})
