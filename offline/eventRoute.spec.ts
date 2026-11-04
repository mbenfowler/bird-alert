import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { DAY_PLAN, DAY_ROUTE, fakeApi, goOffline, goOnline, today } from './fakeApi'
import { pathKm, shortestOrderLocked } from '../src/routePlan'

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

/** The group's route with its stops in a poor order: San Pedro House (far east) first. */
const SCRAMBLED = { ...DAY_PLAN, stops: [DAY_PLAN.stops[4]!, DAY_PLAN.stops[2]!, DAY_PLAN.stops[0]!, DAY_PLAN.stops[3]!, DAY_PLAN.stops[1]!] }
const asPoints = (stops: typeof DAY_PLAN.stops) => stops.map(s => ({ locId: s.locId, name: s.name, lat: s.lat, lng: s.lng }))
const MEET = { locId: null, ...DAY_PLAN.start }

test('"Shortest route" sits under the list and reorders for the least driving from the meeting point', async ({ page, context }) => {
  const api = await routeApi(context, true)
  api.plan = SCRAMBLED
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  const button = page.getByTestId('shortest')
  await expect(button).toHaveText('Shortest route')
  await expect(page.getByTestId('route-menu-items')).toHaveCount(0)
  const expected = shortestOrderLocked(asPoints(SCRAMBLED.stops), [false, false, false, false, false], MEET).map(p => p.name)
  await button.click()
  await expect(page.getByText(/^Saved about .* of driving$/)).toBeVisible()
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect((puts(api)[0]!.stops as Array<{ name: string }>).map(s => s.name)).toEqual(expected)
  expect(pathKm(asPoints(SCRAMBLED.stops), MEET)).toBeGreaterThan(pathKm(shortestOrderLocked(asPoints(SCRAMBLED.stops), [false, false, false, false, false], MEET), MEET))
  await page.getByTestId('shortest').click()
  await expect(page.getByText('Already the shortest')).toBeVisible()
})

test('a locked stop keeps its number when "Shortest route" reorders the rest, even if that drives further, and the lock is saved', async ({ page, context }) => {
  const api = await routeApi(context, true)
  api.plan = SCRAMBLED
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  const lock = page.getByRole('button', { name: 'Keep San Pedro House at #1' })
  await expect(lock).toHaveAttribute('aria-pressed', 'false')
  await expect(lock).toHaveAttribute('title', 'Keep this stop at #1')
  await lock.click()
  await expect(lock).toHaveAttribute('aria-pressed', 'true')
  await expect(rows(page).nth(0)).toHaveAttribute('data-locked', 'true')
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect((puts(api)[0]!.stops as Array<{ locked?: boolean }>)[0]).toMatchObject({ locId: 'L500', locked: true })
  expect((puts(api)[0]!.stops as Array<{ locked?: boolean }>)[1]!.locked).toBeUndefined()

  const locked = [true, false, false, false, false]
  const expected = shortestOrderLocked(asPoints(SCRAMBLED.stops), locked, MEET)
  const free = shortestOrderLocked(asPoints(SCRAMBLED.stops), [false, false, false, false, false], MEET)
  // Locking San Pedro first makes the best route longer than the unlocked best.
  expect(pathKm(expected, MEET)).toBeGreaterThan(pathKm(free, MEET))
  await page.getByTestId('shortest').click()
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(2)
  const sent = puts(api)[1]!.stops as Array<{ name: string; locked?: boolean }>
  expect(sent.map(s => s.name)).toEqual(expected.map(p => p.name))
  expect(sent[0]).toMatchObject({ name: 'San Pedro House', locked: true })
  await expect(rows(page).nth(0)).toContainText('San Pedro House')
  await expect(rows(page).nth(0)).toHaveAttribute('data-locked', 'true')
})

test('toggling a lock moves nothing: the up, down and remove buttons keep their places, at 375 px', async ({ page, context }) => {
  await routeApi(context, true)
  await page.goto('/events/2')
  await expect(rows(page)).toHaveCount(5)
  const row = rows(page).nth(2)
  const places = () => row.locator('.go__stop-tools button').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [Math.round(r.x + window.scrollX), Math.round(r.y + window.scrollY)] }))
  const before = await places()
  expect(before).toHaveLength(4)
  await row.getByTestId('lock').click()
  await expect(row).toHaveAttribute('data-locked', 'true')
  expect(await places()).toEqual(before)
  await expect(page.getByTestId('route-status')).toHaveText('Saved', { timeout: 10_000 })
  expect(await places()).toEqual(before)
  await row.getByTestId('lock').click()
  await expect(row).not.toHaveAttribute('data-locked', 'true')
  expect(await places()).toEqual(before)
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(scroll).toBeLessThanOrEqual(client)
})

test('the meeting point is stop "0": a card with Set meeting point, then Change and Add time', async ({ page, context }) => {
  const api = await routeApi(context, false)
  await page.goto('/events/2')
  const card = page.getByTestId('start-card')
  await expect(card).toContainText('Meeting point')
  await expect(card).toContainText('Where does the day start?')
  // A flag in the stops' ink badge (no letter to translate), named for screen readers.
  await expect(card.getByTestId('start-badge').locator('svg path')).toHaveCount(1)
  await expect(card.getByTestId('start-badge')).toHaveAttribute('aria-label', 'Meeting point')
  await expect(card.getByTestId('start-badge')).toHaveText('')
  await expect(card.getByRole('button', { name: 'Add time' })).toHaveCount(0)
  await card.getByRole('button', { name: 'Set meeting point' }).click()
  // The search and "Use my location" open right under the card.
  const picker = page.locator('.go__start-picker')
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('button', { name: 'Use my location' })).toBeVisible()
  const cardBottom = (await card.boundingBox())!.y + (await card.boundingBox())!.height
  expect(Math.abs((await picker.boundingBox())!.y - cardBottom)).toBeLessThan(24)
  await picker.locator('input[type="search"]').fill('31.55, -110.3')
  await picker.getByRole('button', { name: 'Use 31.55, -110.3' }).click()
  await expect(card).toContainText('31.55, -110.3')
  await expect(card.getByRole('button', { name: 'Change' })).toBeVisible()
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(1)
  expect(puts(api)[0]).toMatchObject({ version: 0, start: { lat: 31.55, lng: -110.3, time: null } })
  // The drive from the meeting point to stop 1 sits between them, like the others.
  await expect(page.locator('[data-testid="route-editor"] .go__stop').first().locator('.go__leg')).toBeVisible()

  await card.getByRole('button', { name: 'Add time' }).click()
  await page.getByTestId('meeting-time').fill('05:15')
  await expect(card).toContainText('31.55, -110.3 · 5:15 AM')
  await expect.poll(() => puts(api).length, { timeout: 10_000 }).toBe(2)
  expect(puts(api)[1]!.start).toMatchObject({ time: '05:15' })
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(scroll).toBeLessThanOrEqual(client)
})
