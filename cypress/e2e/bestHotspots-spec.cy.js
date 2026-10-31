import { login } from '../support/login'

describe('Best hotspots', () => {
  beforeEach(() => {
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
    // The past week starts after the first day on file; the longer windows reach back before it.
    // With a bird: where it was reported, ranked by how reliably.
    cy.fixture('bestHotspots').then((month) => {
      cy.fixture('bestHotspotsSpecies').then((forBird) => {
        cy.intercept('GET', '**/api/ebird/best-hotspots*', (req) => {
          const params = new URL(req.url).searchParams
          const days = Number(params.get('days'))
          if (params.get('species')) return req.reply({ ...forBird, days })
          req.reply(days === 7 ? { ...month, days, since: '2026-10-25', hotspots: month.hotspots.slice(0, 2) } : { ...month, days })
        }).as('best')
      })
    })
  })

  it('a tab on Where to go ranks the county’s hotspots by species, with checklists and the best list', () => {
    cy.visit('http://localhost:3000/go')
    cy.wait('@whereToGo')
    cy.contains('.go-tabs button', 'For your birds').should('have.attr', 'aria-pressed', 'true')
    cy.contains('.go-tabs button', 'Best hotspots').click()
    cy.url().should('include', 'tab=best')
    cy.wait('@best').its('request.url').should('include', 'region=US-GA-139').and('include', 'days=30')
    cy.contains('.go__periods button', 'Past month').should('have.attr', 'aria-pressed', 'true')
    cy.get('.best__list > li').should('have.length', 3)
    cy.get('.best__list > li').first().within(() => {
      cy.get('.best__rank').should('have.text', '1')
      cy.contains('strong', 'Lake Lanier Olympic Park')
      cy.get('.best__counts').should('have.text', '58 species · 21 checklists')
      cy.contains('a', '34 species on Oct 24').should('have.attr', 'href', 'https://ebird.org/checklist/S201')
      cy.contains('a', 'Hotspot on eBird').should('have.attr', 'href', 'https://ebird.org/hotspot/L999')
    })
    cy.get('.best__list > li').eq(2).should('contain', '1 checklist').and('not.contain', 'Best list')
    // Honest about how much is on file: the month reaches back before Bird Alert began here.
    cy.get('.best__note').should('contain', 'Bird Alert started gathering Hall').and('contain', 'Oct 18').and('contain', 'so far')
    cy.get('.best__basis').should('contain', 'Species come from the 41 of 64 checklists')
    // The map carries the ranking: numbered pins, and a tapped row lights its pin.
    cy.get('.sightings-map .map-pin__count').then(($n) => expect([...$n].map((el) => el.textContent)).to.deep.equal(['1', '2', '3']))
    cy.get('.best__list > li').eq(1).find('.go__place-head').click()
    cy.get('.best__list > li').eq(1).should('have.class', 'is-current')
    cy.get('.sightings-map .map-pin--highlight .map-pin__count').should('have.text', '2')
  })

  it('a shorter period asks again, and a window inside what is on file says nothing about it', () => {
    cy.visit('http://localhost:3000/go?tab=best')
    cy.wait('@best')
    cy.contains('.go__periods button', 'Past week').click()
    cy.wait('@best').its('request.url').should('include', 'days=7')
    cy.url().should('include', 'days=7')
    cy.get('.best__list > li').should('have.length', 2)
    cy.get('.best__note').should('not.exist')
  })

  it('the address keeps the tab and period, and the first tab is the page as it was', () => {
    cy.visit('http://localhost:3000/go?tab=best&days=90')
    cy.wait('@best').its('request.url').should('include', 'days=90')
    cy.contains('.go__periods button', 'Past 3 months').should('have.attr', 'aria-pressed', 'true')
    cy.contains('.go-tabs button', 'For your birds').click()
    cy.url().should('not.include', 'tab=')
    cy.wait('@whereToGo')
    cy.get('.go__route-head').should('have.text', 'A morning route')
  })

  it('a hotspot goes on the same route as For your birds, or comes off it, with one tap', () => {
    cy.visit('http://localhost:3000/go?tab=best')
    cy.wait('@best')
    // The suggested route already stops at Lake Lanier.
    cy.get('.best__list > li').first().find('.go__quick-add').should('have.text', '✓ On route')
    cy.get('.best__route').should('contain', 'Your route has 2 stops')
    cy.get('.best__list > li').eq(1).find('.go__quick-add').should('have.text', '+ Add to route').click()
    cy.get('.best__list > li').eq(1).find('.go__quick-add').should('have.text', '✓ On route').and('have.attr', 'aria-pressed', 'true')
    cy.get('.best__route').should('contain', 'Your route has 3 stops')
    cy.get('@putRoute.all').should((puts) => {
      const last = [...puts].reverse().find((p) => 'stops' in p.request.body)
      expect(last?.request.body.stops.map((s) => s.name)).to.include('Yahoola Creek Park')
    })
    cy.contains('.best__route button', 'See your route').click()
    cy.contains('.go-tabs button', 'For your birds').should('have.attr', 'aria-pressed', 'true')
    cy.get('.go__stops > li').should('have.length', 3).last().should('contain', 'Yahoola Creek Park')
  })

  it('a bird narrows the ranking to the hotspots where it was reported, most reliably first, and clears again', () => {
    cy.visit('http://localhost:3000/go?tab=best')
    cy.wait('@best')
    // The search offers only the county's birds: Emperor Goose matches, but isn't on Hall's list.
    cy.get('.best__bird-picker input').type('goose')
    cy.get('.best__bird-picker .place-search__results button').should('have.length', 2).and('not.contain', 'Emperor Goose')
    cy.contains('.best__bird-picker .place-search__results button', 'Canada Goose').click()
    cy.wait('@best').its('request.url').should('include', 'species=cangoo').and('include', 'days=30')
    cy.url().should('include', 'species=cangoo').and('include', 'tab=best')
    cy.get('.best__bird-chip').should('contain', 'Canada Goose')
    cy.get('.best__bird-picker').should('not.exist')
    cy.get('.go__summary').first().should('have.text', 'Hotspots in Hall where Canada Goose was reported in the past month, by how reliably.')
    cy.get('.best__list > li').should('have.length', 2)
    cy.get('.best__list > li').first().within(() => {
      cy.contains('strong', 'Yahoola Creek Park')
      cy.get('.best__counts').should('have.text', 'On 3 of 4 checklists (75%)')
      cy.contains('a', 'Oct 24, 12 birds').should('have.attr', 'href', 'https://ebird.org/checklist/S301')
      cy.contains('a', 'Hotspot on eBird')
      cy.get('.go__quick-add').should('have.text', '+ Add to route')
    })
    cy.get('.best__list > li').eq(1).find('.best__links').should('contain', 'Last seen Oct 22').and('not.contain', 'birds')
    cy.get('.sightings-map .map-pin__count').should('have.length', 2)
    // A new period keeps the bird.
    cy.contains('.go__periods button', 'Past 3 months').click()
    cy.wait('@best').its('request.url').should('include', 'species=cangoo').and('include', 'days=90')
    // Clearing the bird goes back to every bird.
    cy.get('.best__bird-chip button').click()
    cy.url().should('not.include', 'species=')
    cy.get('.best__bird-picker').should('exist')
    cy.get('.best__list > li').first().find('.best__counts').should('have.text', '58 species · 21 checklists')
  })

  it('a bird with no hotspot reports says so', () => {
    cy.intercept('GET', '**/api/ebird/best-hotspots*species=*', { body: { region: 'US-GA-139', days: 30, since: '2026-10-01', onFile: { checklists: 64, detailed: 41, firstDay: '2026-10-01' }, species: { code: 'snogoo', comName: 'Snow Goose' }, hotspots: [] } })
    cy.visit('http://localhost:3000/go?tab=best&species=snogoo')
    cy.get('.go__empty').should('have.text', 'No hotspot checklists in Hall reported Snow Goose in the past month.')
  })

  it('a bird’s own page links to its best hotspots', () => {
    cy.visit('http://localhost:3000/sighting/cangoo/S155544243')
    cy.contains('.sighting__best-link a', 'Best hotspots for Canada Goose').click()
    cy.url().should('include', '/go?tab=best&species=cangoo&days=90')
    cy.wait('@best').its('request.url').should('include', 'species=cangoo').and('include', 'days=90')
    cy.get('.best__bird-chip').should('contain', 'Canada Goose')
    cy.contains('.go__periods button', 'Past 3 months').should('have.attr', 'aria-pressed', 'true')
  })
})
