// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
// Specs visit http://localhost:3000; a run against another port (`--config baseUrl=...`, so
// parallel checkouts each use their own server) goes to that server instead.
Cypress.Commands.overwrite('visit', (originalFn, url, options) =>
  originalFn(typeof url === 'string' ? url.replace(/^http:\/\/localhost:3000(?=\/|$)/, Cypress.config('baseUrl')) : url, options))
