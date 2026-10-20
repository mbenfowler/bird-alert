const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on) {
      on('task', { log(message) { console.log(message); return null } })
    },
    baseUrl: "http://localhost:3000",
    // The nav is sticky; scrolling targets to the centre keeps them out from under it.
    scrollBehavior: "center",
    viewportWidth: 1280,
    viewportHeight: 720,
    specPattern: "**/*-spec.cy.js",
    video: false,
    screenshotsFolder: "cypress/screenshots",
    videosFolder: "cypress/videos",
    experimentalRunAllSpecs: true
  },
});
