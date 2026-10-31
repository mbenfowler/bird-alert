
import './commands'
import 'cypress-axe'

// Third-party hosts never decide a test: the coffee widget and Google Fonts answer empty, so a slow
// CDN from CI can't hold up the page's load event (it timed out a whole run on 2026-10-29).
beforeEach(() => {
  cy.intercept('GET', 'https://cdnjs.buymeacoffee.com/**', { statusCode: 200, headers: { 'content-type': 'application/javascript' }, body: '' })
  cy.intercept('GET', 'https://fonts.googleapis.com/**', { statusCode: 200, headers: { 'content-type': 'text/css' }, body: '' })
  cy.intercept('GET', 'https://fonts.gstatic.com/**', { statusCode: 204, body: '' })
})

// The ask to turn on alerts after saving a bird rises over the foot of the page; outside its own
// spec, every test starts as someone who has already said "Not now" for good, so it never covers
// what a test clicks.
Cypress.on('window:before:load', (win) => {
  if (Cypress.spec.name.startsWith('pushAsk')) return
  try { win.localStorage.setItem('bird-alert:push-ask', JSON.stringify({ dismissals: 3, last: 0 })) } catch { /* no storage: nothing to set */ }
})
