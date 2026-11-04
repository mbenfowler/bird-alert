import { defineConfig, devices } from '@playwright/test'

/**
 * The offline suite: the production build (`vite build`, then `vite preview`), because the service
 * worker only saves the app there; in development it caches nothing. The API is a stateful fake
 * (offline/fakeApi.ts), so nothing leaves the machine. Run: `npm run test:offline`.
 *
 * Chromium only: it is the engine whose offline switch also covers the service worker's own
 * requests, and it can deliver a test push to the worker. WebKit layout stays in the webkit suite.
 */
const PORT = Number(process.env.OFFLINE_PORT) || 4317

export default defineConfig({
  testDir: './offline',
  timeout: 60_000,
  // One at a time: the service worker's timings (a 3.5 s navigation fallback) get flaky under parallel load.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
    timezoneId: 'America/Phoenix',
    trace: 'retain-on-failure',
    ...devices['Pixel 7']
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000
  }
})
