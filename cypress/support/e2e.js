
import './commands'
import 'cypress-axe'

// Third-party hosts never decide a test: the coffee widget and Google Fonts answer empty, so a slow
// CDN from CI can't hold up the page's load event (it timed out a whole run on 2026-10-29).
beforeEach(() => {
  cy.intercept('GET', 'https://cdnjs.buymeacoffee.com/**', { statusCode: 200, headers: { 'content-type': 'application/javascript' }, body: '' })
  cy.intercept('GET', 'https://fonts.googleapis.com/**', { statusCode: 200, headers: { 'content-type': 'text/css' }, body: '' })
  cy.intercept('GET', 'https://fonts.gstatic.com/**', { statusCode: 204, body: '' })
})
