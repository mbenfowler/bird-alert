import { login } from '../support/login'

// One notable sighting for each ABA code, 1 (regular) to 6 (believed extinct).
const BIRDS = [
  ['amerob', 'American Robin'], ['purgal2', 'Purple Gallinule'], ['yegvir', 'Yellow-green Vireo'],
  ['yebwar3', 'Yellow-browed Warbler'], ['motowl', 'Mottled Owl'], ['ivbwoo', 'Ivory-billed Woodpecker']
]
const row = (base) => BIRDS.map(([speciesCode, comName], i) => ({
  ...base, speciesCode, comName, aba: i + 1, subId: `SH${i}`, locId: `LH${i}`, locName: `Spot ${i + 1}`, obsDt: '2026-11-01 08:00'
}))
const card = (code) => cy.get(`.alerts-list .alert-card[data-aba="${code}"]`)

describe('ABA heat on alert cards', () => {
  const open = () => {
    cy.fixture('notableWeek').then((week) => login({ notable: row(week[0]) }))
    cy.get('#notable').click()
    cy.wait('@notable')
  }

  it('warms each card by its ABA code, pulses a 5 and marks a 6 as unconfirmed', () => {
    open()
    ;[1, 2, 3, 4, 5, 6].forEach((code) => card(code).should('have.length', 1))
    card(5).should(($c) => expect(getComputedStyle($c[0]).animationName).to.eq('aba-pulse'))
    card(6).should(($c) => expect(getComputedStyle($c[0]).animationName).to.eq('aba-ember'))
    card(6).should('contain', 'Believed extinct · unconfirmed')
    // The chip says it in words for 3-5; a 1 or 2 gets none.
    card(4).find('.aba-code').should('contain', 'ABA Code 4')
    card(1).find('.aba-code').should('not.exist')
  })

  // The test browser can't be put into reduced motion, so this reads the rule that does it.
  it('with reduced motion the colours stay and nothing pulses', () => {
    open()
    card(6).should(($c) => expect(getComputedStyle($c[0]).backgroundColor).to.eq('rgb(59, 10, 13)'))
    cy.document().then((doc) => {
      const rules = [...doc.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules] } catch { return [] } })
      const still = rules.filter((r) => r.conditionText?.includes('prefers-reduced-motion'))
        .flatMap((m) => [...m.cssRules]).filter((r) => r.selectorText?.includes(".alert-card[data-aba=\"5\"]") || r.selectorText?.includes(".alert-card[data-aba='5']"))
      expect(still.some((r) => r.style.animationName === 'none' || r.style.animation === 'none'), 'a reduced-motion rule stops the pulse').to.eq(true)
    })
  })
})
