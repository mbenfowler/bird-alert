import { defineConfig, devices } from '@playwright/test'

/**
 * Safari's engine only. Cypress covers behaviour in Chrome; this suite loads every page in WebKit
 * at phone sizes and fails on layout that Chrome never shows (grid tracks sized from no-wrap
 * text, dvh units, font-tech queries). Run: `npm run test:webkit`.
 */
export default defineConfig({
  testDir: './webkit',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // Matches the stub user's time zone, so the Alert Center does not issue a time-zone update on its own.
    timezoneId: 'America/New_York',
    // The push worker claims the page once registered, and requests from a controlled page bypass
    // page.route(); it has no fetch handler anyway, so nothing is lost by keeping it out.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    ...devices['iPhone 14']
  },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000
  }
})
