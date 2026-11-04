import { expect, test, type Page } from '@playwright/test'
import { fakeApi, goOffline, today } from './fakeApi'

/**
 * Today's scouting on the production build: the morning push opens /events/<id>#scouting, and with
 * no signal the saved scouting answer still shows the card, scrolled to and lit up.
 */

const plusDays = (n: number) => { const d = new Date(`${today()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

const appSaved = (page: Page) => page.waitForFunction(async () => {
  if (!navigator.serviceWorker.controller) return false
  for (const name of await caches.keys()) {
    if (name.startsWith('bird-alert-shell-') && await (await caches.open(name)).match('/__installed')) return true
  }
  return false
}, undefined, { timeout: 20_000 })
const persisted = (page: Page, text: string) => page.waitForFunction((needle) => (localStorage.getItem('bird-alert-query-cache') ?? '').includes(needle), text)

test.use({ viewport: { width: 375, height: 812 } })

test('#scouting opens on the card, scrolled to and lit up, with signal and then with none', async ({ page, context }) => {
  const api = await fakeApi(context)
  api.eventPatch = { active: false, tally_open: false, scout: true, scout_from: plusDays(-10), starts_on: plusDays(3), ends_on: plusDays(3) }
  api.reported = [{ code: 'eletro', comName: 'Elegant Trogon', locId: 'L100', locName: 'Ramsey Canyon Preserve', lat: 31.4466, lng: -110.3066, obsDt: `${today()} 07:00` }]
  api.scoutingExtra = {
    headline: '2 exciting birds near Cochise Big Day: Rufous-backed Robin and more',
    fresh: [
      { code: 'eletro', comName: 'Elegant Trogon', locName: 'Ramsey Canyon Preserve', locId: 'L100', obsDt: `${today()} 07:00`, aba: 2, flagged: false },
      { code: 'rubrob', comName: 'Rufous-backed Robin', locName: 'Tubac', locId: 'L9', obsDt: `${today()} 08:10`, aba: 3, flagged: true }
    ],
    bird_of_day: { code: 'rubrob', comName: 'Rufous-backed Robin', locName: 'Tubac', obsDt: `${today()} 08:10`, aba: 3, evidence: { confirmed: null, media: true, birders: 2 }, photo: null },
    targets: [
      { code: 'eletro', comName: 'Elegant Trogon', status: 'around', last_obs_dt: `${today()} 07:00`, last_loc_name: 'Ramsey Canyon Preserve', aba: 2, lifer: false },
      { code: 'heptan', comName: 'Hepatic Tanager', status: 'quiet', aba: 1, lifer: false },
      { code: 'mexchi', comName: 'Mexican Chickadee', status: 'missing', aba: 2, lifer: true },
      { code: 'rivhum1', comName: 'Rivoli’s Hummingbird', status: 'around', last_obs_dt: `${plusDays(-2)} 09:00`, last_loc_name: 'Carr Canyon', aba: 1, lifer: false }
    ]
  }
  await page.goto('/events/2#scouting')
  const card = page.getByTestId('scouting-today')
  await expect(page.getByTestId('scouting-headline')).toHaveText('2 exciting birds near Cochise Big Day: Rufous-backed Robin and more')
  await expect(card).toHaveAttribute('data-flash', '')
  // The bird of the day leads, and isn't listed again among the new reports.
  await expect(page.getByTestId('bird-of-day')).toContainText('Rufous-backed Robin')
  await expect(page.getByTestId('scouting-fresh')).toHaveCount(1)
  await expect(page.getByTestId('scouting-fresh').first()).toContainText('Elegant Trogon')
  await expect(page.getByTestId('scouting-progress')).toHaveText('2 of 4 targets around this week')
  await appSaved(page)
  await persisted(page, '"headline"')

  await goOffline(context)
  // Open the event fresh with no signal, the way a tapped push does.
  await page.goto('/')
  await page.goto('/events/2#scouting')
  await expect(page.getByTestId('scouting-headline')).toHaveText(/2 exciting birds/)
  await expect(card).toHaveAttribute('data-flash', '')
  await expect.poll(() => card.evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(140)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(page.getByTestId('bird-of-day')).toContainText('Tubac')
  await expect(page.locator('#event-targets [data-code="eletro"] .event__dot')).toBeVisible()
  await expect(card).not.toHaveAttribute('data-flash', '', { timeout: 5000 })
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(scroll, 'page scrolls sideways').toBeLessThanOrEqual(client)
})
