import { stubAuth } from '../support/stubs'

describe('Splash page', () => {
  beforeEach(() => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/notable*', { fixture: 'notableWeek' }).as('notableWeek')
    cy.intercept('GET', '**/api/ebird/observations*', { fixture: 'notableWeek' })
    cy.intercept('GET', '**/api/birds?*', { statusCode: 200, body: [{ speciesCode: 'paibun', comName: 'Painted Bunting', sciName: 'Passerina ciris', birdImg: '/images/bird.png' }] }).as('birds')
  })

  it('greets a visitor with what the app does and what is being seen right now, then sends them to sign up', () => {
    cy.visit('http://localhost:3000/')
    cy.url().should('eq', 'http://localhost:3000/')
    cy.contains('h1', 'Know where the birds are this morning.')
    cy.wait('@notableWeek').its('request.url').should('include', 'region=US-GA-139').and('include', 'back=7')
    cy.get('.landing__live-title').should('contain', 'Notable this week in Hall County')
    // One row per bird, newest report first, the number of reports and places folded in.
    cy.get('.landing__bird').should('have.length', 2)
    cy.get('.landing__bird').first().should('contain', 'Painted Bunting').and('contain', 'Chicopee Lake').and('contain', '2 reports, 2 places')
    cy.get('.landing__bird').first().find('img.landing__thumb').should('have.attr', 'src', '/images/bird.png')
    // Someone's yard is named only by its town, never its street address.
    cy.get('.landing__bird').last().should('contain', 'A private yard near Gainesville').and('not.contain', 'Monroe')
    cy.get('.landing__bird').last().should('contain', 'Sedge Wren').find('.landing__ebird').should('have.attr', 'href', 'https://ebird.org/checklist/S100000003')
    cy.get('.landing__stat').should('contain', '2 species reported in Hall County')
    cy.get('.landing__feature').should('have.length', 4)
    cy.get('nav .nav-login').should('have.text', 'Log in')
    cy.contains('.landing__ctas a', 'Start free').click()
    cy.url().should('include', '/login')
    cy.get('nav .nav-login').should('not.exist')
  })

  it('another county is one pick away, and is remembered', () => {
    cy.visit('http://localhost:3000/')
    cy.wait('@notableWeek')
    cy.get('.landing__pickers select').eq(1).select('Fulton')
    cy.wait('@notableWeek').its('request.url').should('include', 'region=US-GA-121')
    cy.reload()
    cy.wait('@notableWeek').its('request.url').should('include', 'region=US-GA-121')
    cy.get('.landing__pickers select').first().select('Colorado')
    cy.wait('@notableWeek').its('request.url').should('include', 'region=US-CO&')
  })
})

describe('Shared links', () => {
  it('a shared route opens without an account: stops, drives, the map and Maps', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/share?id=route12345', { body: {
      id: 'route12345', kind: 'route', createdAt: '2026-10-27T12:00:00Z', regionName: 'Hall', title: null, covers: 'Covers about 9 birds of a 40-bird watch list.',
      stops: [
        { name: 'Chicopee Lake', lat: 34.25, lng: -83.85, locId: 'L1', detail: '3.1 birds expected · best 8 am to 10 am', birds: ['Pine Warbler 72%'] },
        { name: 'North Hall Community Center & Park', lat: 34.39, lng: -83.81, locId: 'L2', detail: null, birds: [] }
      ],
      drive: { minutes: 22, miles: 14.1, legs: [{ minutes: 22, miles: 14.1 }], geometry: [[34.25, -83.85], [34.39, -83.81]] }
    } }).as('share')
    cy.visit('http://localhost:3000/share/r/route12345')
    cy.url().should('include', '/share/r/route12345')
    cy.contains('h1', 'A morning route in Hall')
    cy.get('.shared__lede').should('contain', '2 stops · 22 minutes of driving, 14.1 miles').and('contain', 'Covers about 9 birds')
    cy.get('.shared__stops > li').should('have.length', 2).last().should('contain', '↓ 22 min drive · 14.1 mi')
    cy.get('.sightings-map .map-stop').should('have.length', 2)
    cy.contains('a', 'Open the route in Maps').should('have.attr', 'href').and('include', 'destination=34.39%2C-83.81').and('not.include', 'origin=')
    cy.contains('.shared__invite a', 'Start free').should('have.attr', 'href', '/login')
  })

  it('a shared sighting shows the bird, the place and the way there', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/share?id=sight12345', { body: {
      id: 'sight12345', kind: 'sighting', createdAt: '2026-10-27T12:00:00Z', speciesCode: 'paibun', comName: 'Painted Bunting', sciName: 'Passerina ciris', birdImg: '/images/bird.png',
      locName: 'Chicopee Lake', lat: 34.25, lng: -83.85, obsDt: '2026-10-27 08:10', howMany: 2, subId: 'S100000001', regionName: 'Hall'
    } })
    cy.visit('http://localhost:3000/share/s/sight12345')
    cy.contains('h1', 'Painted Bunting')
    cy.get('.shared__lede').should('contain', '2 reported at').and('contain', 'Chicopee Lake').and('contain', '(Hall)')
    cy.contains('a', 'The checklist on eBird').should('have.attr', 'href', 'https://ebird.org/checklist/S100000001')
    cy.contains('a', 'Directions').should('have.attr', 'href').and('include', '34.25%2C-83.85')
    // A tall photo is never cropped: the whole bird shows, over a blurred copy of itself.
    cy.get('.shared__photo img').should('have.css', 'object-fit', 'contain')
    // An older link has no eBird place, so there's no "still there?" to ask.
    cy.get('.still-there').should('not.exist')
  })

  it('a shared sighting says whether the bird is still there', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/share?id=sight67890', { body: {
      id: 'sight67890', kind: 'sighting', createdAt: '2026-10-27T12:00:00Z', speciesCode: 'paibun', comName: 'Painted Bunting', sciName: 'Passerina ciris', birdImg: '/images/bird.png',
      locId: 'L999', locName: 'Chicopee Lake', lat: 34.25, lng: -83.85, obsDt: '2026-10-27 08:10', howMany: 2, subId: 'S100000001', regionName: 'Hall'
    } })
    cy.intercept('GET', '**/api/ebird/chase?*', { body: { locId: 'L999', speciesCode: 'paibun', lastSeen: '2026-10-27 08:10', hoursAgo: 30, checkedSince: 3, foundSince: 0, missesSince: 3, stillThere: 18, chance: 11, verdict: 'gone' } }).as('chase')
    cy.visit('http://localhost:3000/share/s/sight67890')
    cy.wait('@chase').its('request.url').should('include', 'locId=L999').and('include', 'code=paibun')
    cy.get('.still-there').should('contain', 'Probably gone').and('contain', '30 hours ago').and('contain', '3 checklists since didn’t have it.')
    // No tested chance for a place on a shared page, so the facts stand alone.
    cy.get('.still-there__chance').should('not.exist')
  })

  it('a visitor who lands on a shared link carries it to signup, first visit winning', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/share?id=sight67890', { body: {
      id: 'sight67890', kind: 'sighting', createdAt: '2026-10-27T12:00:00Z', speciesCode: 'paibun', comName: 'Painted Bunting', sciName: 'Passerina ciris', birdImg: '/images/bird.png',
      locName: 'Chicopee Lake', lat: 34.25, lng: -83.85, obsDt: '2026-10-27 08:10', howMany: 2, subId: 'S100000001', regionName: 'Hall'
    } })
    cy.visit('http://localhost:3000/share/s/sight67890?utm_source=x')
    cy.contains('h1', 'Painted Bunting')
    cy.window().then((win) => expect(JSON.parse(win.localStorage.getItem('arrivedFrom'))).to.deep.include({ landing: 'share-sighting', share: 'sight67890', utm: 'x' }))
    // A later visit to the home page doesn't replace it.
    cy.visit('http://localhost:3000/')
    cy.window().then((win) => expect(JSON.parse(win.localStorage.getItem('arrivedFrom'))).to.deep.include({ landing: 'share-sighting', share: 'sight67890' }))
  })

    it('a link that never existed says so kindly', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/share?id=nothere123', { statusCode: 404, body: { error: 'This link has expired or never existed' } })
    cy.visit('http://localhost:3000/share/s/nothere123')
    cy.contains('h1', 'This link didn’t open')
    cy.contains('expired or never existed')
  })
})

describe('ABA Checklist codes', () => {
  it('a notable bird rare in the whole ABA Area carries its code on the splash; a regular one does not', () => {
    stubAuth()
    cy.fixture('notableWeek').then((rows) => {
      cy.intercept('GET', '**/api/ebird/notable*', { body: rows.map((r) => ({ ...r, aba: r.speciesCode === 'sedwre' ? 4 : 1 })) })
    })
    cy.intercept('GET', '**/api/ebird/observations*', { fixture: 'notableWeek' })
    cy.intercept('GET', '**/api/birds?*', { body: [] })
    cy.visit('http://localhost:3000/')
    cy.contains('.landing__bird', 'Sedge Wren').find('.aba-code').should('have.text', 'ABA Code 4 · casual')
    cy.contains('.landing__bird', 'Painted Bunting').find('.aba-code').should('not.exist')
  })

  it('a shared sighting of a coded bird explains the code and credits the ABA on a tap', () => {
    stubAuth()
    cy.intercept('GET', '**/api/ebird/share?id=sight24680', { body: {
      id: 'sight24680', kind: 'sighting', createdAt: '2026-10-28T12:00:00Z', speciesCode: 'roahaw', comName: 'Roadside Hawk', sciName: 'Rupornis magnirostris', birdImg: '/images/bird.png',
      locName: 'Estero Llano Grande SP', lat: 26.12, lng: -97.95, obsDt: '2026-10-28 08:10', howMany: 1, subId: 'S100000009', regionName: 'Texas', aba: 4
    } })
    cy.visit('http://localhost:3000/share/s/sight24680')
    cy.get('.shared__aba summary').should('have.text', 'ABA Code 4 · casual').click()
    cy.get('.aba-code-note__panel').should('contain', 'not seen every year in the ABA Area').and('contain', 'used with permission of the American Birding Association')
  })
})
