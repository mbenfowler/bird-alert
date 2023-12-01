const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    "baseUrl": "http://localhost:3000",
    "viewportWidth": 1280,
    "viewportHeight": 720,
    "specPattern": "**/*-spec.cy.js",
    "video": false,
    "screenshotsFolder": "cypress/screenshots",
    "videosFolder": "cypress/videos",
    experimentalRunAllSpecs: true
  },
});
