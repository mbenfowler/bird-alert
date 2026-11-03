import { stubAuth } from '../support/stubs'
import { TEST_USER } from '../support/login'
import esMX from '../../src/locales/es-MX.json'
import frCA from '../../src/locales/fr-CA.json'

const LOCALES = [{ locale: 'en', name: 'English' }, { locale: 'es-MX', name: 'Español (México)' }, { locale: 'fr-CA', name: 'Français (Canada)' }]
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const EVENT = {
  id: 5, name: 'Big Day Chiricahuas', state: 'AZ', location: 'US-AZ-003', range_mi: 30,
  starts_on: day(30), ends_on: day(30), kind: 'bigday', scout: true, scout_days: 21, scout_from: day(9), active: false,
  role: 'organizer', display_name: 'Matt',
  members: [{ display_name: 'Jane', role: 'member' }, { display_name: 'Matt', role: 'organizer', you: true }],
  targets: [{ code: 'eletro', lifer_for: ['Jane'] }], tally: [],
  invite_url: '/events/join/inv123', view_url: '/events/view/view456'
}

// Settings → Language switches the whole page, and the screens stay within a phone's width.
const LANGUAGES = [
  { locale: 'fr-CA', words: frCA, settings: 'Paramètres' },
  { locale: 'es-MX', words: esMX, settings: 'Configuración' }
]

const noSidewaysScroll = () => cy.document().then(doc => expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(375))

describe('Translations', () => {
  LANGUAGES.forEach(({ locale, words, settings }) => {
    it(`switches to ${locale} from Settings and shows its words`, () => {
      stubAuth({ loggedIn: true })
      cy.intercept('GET', '**/api/ebird/name-locales*', { statusCode: 200, body: LOCALES })
      cy.visit('http://localhost:3000/settings')
      cy.contains('h2', 'Your details')
      cy.get('select[name="locale"]').select(locale)
      cy.wait('@patchUser').its('request.body').should('deep.equal', { locale })
      cy.get('html').should('have.attr', 'lang', locale)
      cy.contains('#settingsText', settings)
      cy.contains('h2', words.account.title)
      cy.contains(words.account.languageHint)
      cy.contains(words.settings.tab.alerts)
      cy.title().should('eq', words.app.title)
    })

    it(`keeps nav, the Alert Center and an event page within 375px in ${locale}`, () => {
      stubAuth({ loggedIn: true, user: { ...TEST_USER, locale } })
      cy.intercept('GET', '**/api/birds*', { statusCode: 200, body: [{ speciesCode: 'eletro', comName: 'Elegant Trogon', sciName: 'Trogon elegans', birdImg: null }] })
      cy.intercept('GET', '**/api/saved?kind=events*', { statusCode: 200, body: [EVENT] })
      cy.intercept('GET', '**/api/saved?kind=event-suggestions*', { statusCode: 200, body: { suggestions: [] } })
      cy.viewport(375, 740)
      cy.visit('http://localhost:3000/')
      cy.get('html').should('have.attr', 'lang', locale)
      cy.get(`nav a[aria-label="${words.nav.events}"]`).should('exist')
      noSidewaysScroll()
      cy.visit('http://localhost:3000/settings?tab=alerts')
      cy.contains(words.alertCenter.timingLegend)
      cy.contains(words.range.title)
      noSidewaysScroll()
      cy.visit('http://localhost:3000/events/5')
      cy.contains('Big Day Chiricahuas')
      cy.contains(words.events.targets)
      noSidewaysScroll()
      cy.visit('http://localhost:3000/events')
      cy.contains(words.events.pageTitle)
      noSidewaysScroll()
    })
  })
})
