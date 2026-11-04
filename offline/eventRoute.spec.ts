import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { DAY_PLAN, DAY_ROUTE, fakeApi, goOffline, goOnline, today } from './fakeApi'

/**
 * The event page's route on the production build: open on load (the group's, else the
 * suggestion), edited in place with no edit mode, the first change saving the suggestion as the
 * group's route, the ⋯ menu, edits queued with no signal, the map and list pointing at each
 * other, no layout shift as it saves, and a phone's width.
 */

const at = (utc: string) => new Date(`${today()}T${utc}:00Z`)
const plusDays = (n: number) => { const d = new Date(`${today()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

const appSaved = (page: Page) => page.waitForFunction(async () => {
  if (!navigator.serviceWorker.controller) return false
  for (const name of await caches.keys()) {
    if (name.startsWith('bird-alert-shell-') && await (await caches.open(name)).match('/__installed')) return true
  }
  return false
}, undefined, { timeout: 20_000 })
const persisted = (page: Page, text: string) => page.waitForFunction((needle) => (localStorage.getItem('bird-alert-query-cache') ?? '').includes(needle), text)

/** Two days out (not the day itself), with the suggestion and one more place in the scouting reports. */
const routeApi = async (context: BrowserContext, saved: boolean) => {
  const api = await fakeApi(context)
  api.route = DAY_ROUTE
  if (saved) api.plan = DAY_PLAN
  api.eventPatch = { active: false, tally_open: false, starts_on: plusDays(2), ends_on: plusDays(2) }
  api.reported = [{ code: 'arizwo', comName: 'Arizona Woodpecker', locId: 'L300', locName: 'Miller Canyon', lat: 31.4159, lng: -110.2766, obsDt: `${today()} 07:00` }]
  return api
}

const rows = (page: Page) => page.getByTestId('route-editor').getByTestId('route-row')
const puts = (api: { planPuts: Array<Record<string, unknown>> }) => api.planPuts

test.use({ viewport: { width: 375, height: 812 } })

test('the group\'s saved route is on the page at load, with no clicks', async ({ page, context }) => {
  await routeApi(context, true)
  await page.goto('/events/2')
  await expect(page.getByTestId('route-heading')).toHaveText('Your group’s route · edited by you')
  await expect(rows(page)).toHaveCount(5)
  await expect(rows(page).nth(0)).toContainText('Ramsey Canyon Preserve')
  await expect(page.getByTestId('meeting-time')).toHaveValue('05:30')
  await expect(page.getByRole('button', { name: 'Plan a route' })).toHaveCount(0)
  // Above scouting and the targets.
  const routeTop = (await page.getByTestId('event-route').boundingBox())!.y
  expect(routeTop).toBeLessThan((await page.locator('#event-targets').boundingBox())!.y)
  expect(routeTop).toBeLessThan((await page.getByTestId('event-scouting').boundingBox())!.y)
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(scroll).toBeLessThanOrEqual(client)
})

test('with none saved the suggestion shows at once, and its first edit saves it as the group\'s route (version 0)', async ({ page, context }) => {
  const api = await routeApi(context, false)
  await page.goto('/events/2')
  await expect(page.getByTestId('route-heading')).toHaveText('Suggested route')
  await expect(page.getByText('Change anything and it becomes your group’s route.')).toBeVisible()
  await expect(rows(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'More time at Carr Canyon' }).click()
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect(puts(api)[0]).toMatchObject({ version: 0, stops: [{ locId: 'L100', stay_min: null }, { locId: 'L200', stay_min: 35 }] })
  await expect(page.getByTestId('route-heading')).toHaveText(/^Your group’s route · edited by you/)
})

test('reorder, stay, remove and add, each straight from the list', async ({ page, context }) => {
  const api = await routeApi(context, true)
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  await page.getByRole('button', { name: 'Move Ramsey Canyon Preserve down' }).click()
  await expect(rows(page).nth(0)).toContainText('Carr Canyon')
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect((puts(api)[0]!.stops as Array<{ locId: string }>).map(s => s.locId)).toEqual(['L200', 'L100', 'L300', 'L400', 'L500'])

  await page.getByRole('button', { name: 'Less time at Ramsey Canyon Preserve' }).click()
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(2)
  expect((puts(api)[1]!.stops as Array<{ locId: string; stay_min: number }>)[1]).toMatchObject({ locId: 'L100', stay_min: 40 })

  await page.getByRole('button', { name: 'Remove Ash Canyon' }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(3)
  // Each save goes on the version the last one made.
  expect(puts(api).map(p => p.version)).toEqual([3, 4, 5])

  await page.getByRole('button', { name: 'Remove Miller Canyon' }).click()
  await expect(rows(page)).toHaveCount(3)
  await page.getByTestId('add-stop').click()
  await page.getByRole('button', { name: /Miller Canyon/ }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect(rows(page).nth(3)).toContainText('Miller Canyon')
  await expect.poll(() => (puts(api).at(-1)!.stops as unknown[]).length, { timeout: 10_000 }).toBe(4)
})

test('the meeting time is saved with the route, and the planned times follow it', async ({ page, context }) => {
  const api = await fakeApi(context)
  api.plan = DAY_PLAN
  api.route = DAY_ROUTE
  await page.clock.setFixedTime(at('12:00'))
  await page.goto('/events/2')
  const first = page.getByTestId('day-stops').getByTestId('day-stop').nth(0).getByTestId('planned-time')
  await expect(first).toHaveText('5:50 AM–6:35 AM')
  await page.getByTestId('meeting-time').fill('06:00')
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect(puts(api)[0]!.start).toMatchObject({ name: 'Sierra Vista Walmart', time: '06:00' })
  await expect(first).toHaveText('6:20 AM–7:05 AM')
})

test('the ⋯ menu: whole route in parts, start from my location, and back to the suggestion after asking', async ({ page, context }) => {
  const api = await routeApi(context, true)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 31.5512, longitude: -110.2849 })
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  await page.getByTestId('route-menu').click()
  const menu = page.getByTestId('route-menu-items')
  await expect(menu.getByTestId('route-link')).toHaveCount(2)
  for (const href of await menu.getByTestId('route-link').evaluateAll(els => els.map(el => el.getAttribute('href')!))) {
    expect((new URL(href).searchParams.get('waypoints') ?? '').split('|').filter(Boolean).length).toBeLessThanOrEqual(3)
  }
  await menu.getByRole('menuitem', { name: 'Start from my location' }).click()
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect(puts(api)[0]!.start).toMatchObject({ name: 'My location', lat: 31.5512, lng: -110.2849, time: '05:30' })

  await page.getByTestId('route-menu').click()
  await menu.getByRole('menuitem', { name: 'Back to the suggested route' }).click()
  await expect(page.getByText('Go back to the suggested route? This clears the route for everyone in the group.')).toBeVisible()
  await page.getByRole('button', { name: 'Go back' }).click()
  await expect(page.getByTestId('route-heading')).toHaveText('Suggested route')
  await expect(rows(page)).toHaveCount(2)
  expect(api.calls).toContain('DELETE event-route-plan')
})

test('an edit with no signal waits on the phone, survives a reload, and saves once when signal returns', async ({ page, context }) => {
  const api = await routeApi(context, true)
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  await appSaved(page)
  await persisted(page, '"event-route-plan"')
  await goOffline(context)
  await page.getByRole('button', { name: 'Remove Ash Canyon' }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect(page.getByTestId('route-status')).toHaveText('Saved on this phone; it goes to the group when there’s signal.', { timeout: 10_000 })
  await persisted(page, '"event-route-save"')
  await page.reload()
  await expect(rows(page)).toHaveCount(4)
  expect(puts(api)).toHaveLength(0)
  await goOnline(context)
  await expect.poll(() => puts(api).length, { timeout: 20_000 }).toBe(1)
  await expect(page.getByTestId('route-status')).toHaveText('Saved', { timeout: 10_000 })
  expect((puts(api)[0]!.stops as unknown[]).length).toBe(4)
})

test('tapping a row lights its pin, and tapping a pin lights its row', async ({ page, context }) => {
  await routeApi(context, true)
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  await rows(page).nth(2).locator('.go__stop-main').click()
  await expect(rows(page).nth(2)).toHaveClass(/is-active/)
  await expect(page.locator('.event-route-panel__map .map-stop--active')).toHaveText('3')
  await page.locator('.event-route-panel__map .map-stop', { hasText: /^1$/ }).click({ force: true })
  await expect(rows(page).nth(0)).toHaveClass(/is-active/)
  await expect(rows(page).nth(2)).not.toHaveClass(/is-active/)
})

test('nothing jumps while a change saves: the steppers and rows keep their place', async ({ page, context }) => {
  await routeApi(context, true)
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  const plus = page.getByRole('button', { name: 'More time at Carr Canyon' })
  // Where it sits on the page (not in the viewport, which scrolls to tap it).
  const top = () => plus.evaluate(el => el.getBoundingClientRect().top + window.scrollY)
  const firstRow = () => rows(page).nth(0).evaluate(el => el.getBoundingClientRect().top + window.scrollY)
  const before = await top()
  const rowBefore = await firstRow()
  await plus.click()
  await expect(page.getByTestId('route-status')).toHaveText(/Saving…|Saved/, { timeout: 10_000 })
  expect(await top()).toBeCloseTo(before, 0)
  await expect(page.getByTestId('route-status')).toHaveText('Saved', { timeout: 10_000 })
  expect(await top()).toBeCloseTo(before, 0)
  expect(await firstRow()).toBeCloseTo(rowBefore, 0)
})

test('"Start the day" on a route that is still the suggestion saves it first, then the position, in order', async ({ page, context }) => {
  const api = await fakeApi(context)
  api.route = DAY_ROUTE
  await page.clock.setFixedTime(at('13:00'))
  await page.goto('/events/2')
  await expect(page.getByTestId('route-heading')).toHaveText('Suggested route')
  await page.getByTestId('start-day').click()
  await expect.poll(() => api.positionPosts.length, { timeout: 10_000 }).toBe(1)
  expect(puts(api)[0]).toMatchObject({ version: 0 })
  expect(api.calls.indexOf('PUT event-route-plan')).toBeLessThan(api.calls.indexOf('POST event-route-position'))
  await expect(page.getByTestId('group-position')).toContainText('Now at Ramsey Canyon Preserve · you')
})
