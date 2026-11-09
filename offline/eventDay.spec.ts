import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { appSaved, DAY_PLAN, DAY_ROUTE, fakeApi, goOffline, goOnline, today } from './fakeApi'

/**
 * The event day on the production build: get ready for offline, the day view on top, stop mode
 * against a frozen clock, directions, the group log and the checklist keeper, removing with
 * confirm and undo. Each runs offline after one visit with signal.
 */

/** 6:38 AM in Arizona today is `at('13:38')`. */
const at = (utc: string) => new Date(`${today()}T${utc}:00Z`)

const persisted = (page: Page, text: string) => page.waitForFunction((needle) => (localStorage.getItem('bird-alert-query-cache') ?? '').includes(needle), text)

/** The fake backend with the group's route saved, and a tally of four birds from three members. */
const dayApi = async (context: BrowserContext) => {
  const api = await fakeApi(context)
  api.plan = DAY_PLAN
  api.route = DAY_ROUTE
  const t = (utc: string) => at(utc).toISOString()
  api.tally = [
    { id: 1, code: 'eletro', added_by_name: 'Jane', added_at: t('13:10'), observed_at: t('13:10'), stop_index: 0, stop_name: 'Ramsey Canyon Preserve' },
    // Sam was out of signal in Carr Canyon: seen at 6:20 AM, reached the server at 7:30.
    { id: 2, code: 'arizwo', added_by_name: 'Sam', added_at: t('14:30'), observed_at: t('13:20'), stop_index: 0, stop_name: 'Ramsey Canyon Preserve' },
    { id: 3, code: 'mexchi', added_by_name: 'Matt', added_by_you: true, added_at: t('13:25'), observed_at: t('13:25') }
  ]
  return api
}

/** Freezes the page's clock (timers keep running) and lets the day view catch up. */
const setClock = async (page: Page, time: Date) => {
  await page.clock.setFixedTime(time)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

const noSidewaysScroll = async (page: Page) => {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(scroll, 'page scrolls sideways').toBeLessThanOrEqual(client)
}

test.use({ viewport: { width: 375, height: 812 } })

test('get ready for offline saves the day, then the event, tally and log all open with no signal', async ({ page, context }) => {
  await dayApi(context)
  await setClock(page, at('13:00'))
  await page.goto('/events/2')
  await appSaved(page)
  await page.reload()
  await expect(page.getByTestId('ready-status')).toHaveText('Not saved yet. Save while you have signal.')
  await expect(page.getByTestId('get-ready-button')).toHaveText('Save for offline')
  await page.getByTestId('get-ready-button').click()
  await expect(page.getByTestId('ready-status')).toHaveText(/^Saved \d.* · good for 7 days, until /)
  for (const line of ['event', 'tally', 'photos', 'app']) await expect(page.getByTestId(`ready-line-${line}`)).toHaveAttribute('data-done', 'true')
  await expect(page.getByTestId('ready-line-photos')).toContainText('Target photos: 3 of 3')
  await expect(page.getByTestId('ready-line-app')).toContainText('App saved to this phone')
  // The maps app's offline map is the person's own tick.
  await expect(page.getByTestId('ready-line-map')).toHaveAttribute('data-done', 'false')
  await expect(page.getByTestId('get-ready')).toHaveClass(/is-ready/)
  await expect(page.getByTestId('get-ready-button')).toHaveText('Update')
  expect(await page.evaluate(() => localStorage.getItem('bird-alert:event-ready:2'))).toMatch(/^\d+$/)
  // Android: Google Maps only, opened on the day's area.
  await expect(page.getByTestId('maps-open-google')).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/@\?api=1&map_action=map&center=-?[\d.]+,-?[\d.]+&zoom=(8|9|10|11|12)$/)
  await expect(page.getByTestId('maps-open-apple')).toHaveCount(0)
  await persisted(page, '"event-log"')

  await goOffline(context)
  await page.reload()
  await expect(page.getByTestId('day-view')).toBeVisible()
  await expect(page.getByTestId('ready-status')).toContainText('good for 7 days')
  for (const line of ['event', 'tally', 'photos', 'app']) await expect(page.getByTestId(`ready-line-${line}`)).toHaveAttribute('data-done', 'true')
  await expect(page.getByTestId('day-stops').getByTestId('day-stop')).toHaveCount(5)
  await noSidewaysScroll(page)
  // A bird photo comes from the worker's saved copy.
  const photo = await page.evaluate(async (url) => (await fetch(url, { mode: 'no-cors' })).type, 'https://upload.wikimedia.org/wikipedia/commons/heptan.jpg')
  expect(['basic', 'cors', 'opaque']).toContain(photo)

  await page.getByTestId('day-open-log').click()
  await expect(page.getByTestId('group-log').locator('li')).toHaveCount(3)
  await noSidewaysScroll(page)
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('tally-count')).toContainText('3 species')
  await noSidewaysScroll(page)
})

test('on the day the day view leads the page, above the route and the targets', async ({ page, context }) => {
  await dayApi(context)
  await setClock(page, at('13:38'))
  await page.goto('/events/2')
  const day = page.getByTestId('day-view')
  await expect(day).toBeVisible()
  await expect(day.getByTestId('sun-times')).toContainText('Sunrise')
  await expect(day.getByTestId('day-open-tally')).toContainText('Open tally · 3 species')
  const dayTop = (await day.boundingBox())!.y
  const targetsTop = (await page.locator('#event-targets').boundingBox())!.y
  const stopsTop = (await page.getByTestId('day-stops').boundingBox())!.y
  expect(dayTop).toBeLessThan(stopsTop)
  expect(stopsTop).toBeLessThan(targetsTop)
  // Directly under the title and the area line.
  expect(dayTop).toBeLessThan(400)
  // Not archived away mid-day.
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0)
  await noSidewaysScroll(page)
})

test('stop mode: the timer against the stay, time to go, and how far behind the day is (frozen clock)', async ({ page, context }) => {
  await dayApi(context)
  await setClock(page, at('12:30')) // 5:30 AM
  await page.goto('/events/2')
  // Planned from the group's meeting time (5:30, saved with the meeting point): Ramsey 5:50–6:35 (before civil dawn: owling), Carr 6:50–7:20 …
  const rows = page.getByTestId('day-stops').getByTestId('day-stop')
  await expect(rows.nth(0).getByTestId('planned-time')).toHaveText('5:50 AM–6:35 AM')
  await expect(rows.nth(0).getByTestId('owl')).toHaveText('🦉 before dawn')
  await expect(rows.nth(1).getByTestId('planned-time')).toHaveText('6:50 AM–7:20 AM')
  await expect(rows.nth(1).getByTestId('owl')).toHaveCount(0)

  await page.getByTestId('start-day').click()
  await expect(page.getByTestId('schedule-status')).toHaveText('On schedule')
  await setClock(page, at('12:52'))
  await page.getByTestId('were-here').click()
  await expect(page.getByTestId('stop-now')).toContainText('Ramsey Canyon Preserve')
  await expect(page.getByTestId('group-position')).toHaveText('Now at Ramsey Canyon Preserve · you, 5:52 AM')
  await setClock(page, at('13:30')) // 6:30 AM
  await expect(page.getByTestId('stop-timer')).toHaveText('38 of 45 min')
  await expect(page.getByTestId('time-to-go')).toHaveCount(0)

  await setClock(page, at('13:52')) // 6:52 AM, 17 minutes past the planned 6:35
  await expect(page.getByTestId('time-to-go')).toHaveText('Time to head to Carr Canyon')
  await expect(page.getByTestId('schedule-status')).toHaveText('17 min behind · trim Carr Canyon?')

  // Shared through the group's route and saved with it: a reload with no signal keeps the stop and the timer.
  await appSaved(page)
  await persisted(page, '"position":{"stop":0')
  await goOffline(context)
  await page.reload()
  await setClock(page, at('13:52'))
  await expect(page.getByTestId('stop-timer')).toHaveText('60 of 45 min')
  await expect(page.getByTestId('stop-next')).toContainText('Carr Canyon')
})

test('targets still needed at the stop cross off as birds are added, offline', async ({ page, context }) => {
  await dayApi(context)
  await setClock(page, at('13:00'))
  await page.goto('/events/2')
  await page.getByTestId('start-day').click()
  await page.getByTestId('were-here').click()
  const needed = page.getByTestId('stop-now').getByTestId('needed-here')
  await expect(needed).toContainText('2 targets still needed here')
  await expect(needed.locator('[data-got="true"]')).toHaveText(/Elegant Trogon/)
  await appSaved(page)
  await persisted(page, '"event-route-plan"')

  await goOffline(context)
  await page.getByTestId('day-open-tally').click()
  await page.getByRole('button', { name: '+ Hepatic Tanager' }).click()
  await page.getByRole('link', { name: 'Back to the event' }).click()
  await expect(needed).toContainText('1 target still needed here')
  await expect(needed.locator('[data-got="true"]')).toHaveCount(2)
})

test('directions go to the next stop in Google and Apple Maps, and the whole route opens in parts of 3 waypoints', async ({ page, context }) => {
  await dayApi(context)
  await setClock(page, at('13:00'))
  await page.goto('/events/2')
  await page.getByTestId('start-day').click()
  await page.getByTestId('were-here').click()
  const next = page.getByTestId('stop-next')
  await expect(next.getByTestId('directions-google')).toHaveText('Directions to Carr Canyon')
  await expect(next.getByTestId('directions-google')).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=31.4325,-110.2671&travelmode=driving')
  await expect(next.getByTestId('directions-apple')).toHaveAttribute('href', 'https://maps.apple.com/?daddr=31.4325,-110.2671&dirflg=d')
  const links = page.getByTestId('day-stops').getByTestId('route-link')
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveText('Part 1: meeting point to stop 4')
  await expect(links.nth(1)).toHaveText('Part 2: stops 4 to 5')
  for (const href of await links.evaluateAll(els => els.map(el => el.getAttribute('href')!))) {
    const waypoints = new URL(href).searchParams.get('waypoints')
    expect((waypoints ?? '').split('|').filter(Boolean).length).toBeLessThanOrEqual(3)
  }
})

test('the group log is in the order seen, with a late-synced bird slotted in and marked', async ({ page, context }) => {
  await dayApi(context)
  await setClock(page, at('14:40'))
  await page.goto('/events/2/log')
  const rows = page.getByTestId('group-log').locator('li')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('Jane · Elegant Trogon · 6:10 AM · near Ramsey Canyon Preserve')
  await expect(rows.nth(1)).toContainText('Sam · Arizona Woodpecker · 6:20 AM')
  await expect(rows.nth(1)).toHaveAttribute('data-late', 'true')
  await expect(rows.nth(1).getByTestId('synced-later')).toHaveText('synced later')
  await expect(rows.nth(0)).not.toHaveAttribute('data-late', 'true')
  await expect(rows.nth(2)).toContainText('You · Mexican Chickadee · 6:25 AM')
  await noSidewaysScroll(page)
})

test('the checklist keeper ticks off others\' birds, offline, and can undo', async ({ page, context }) => {
  const api = await dayApi(context)
  await setClock(page, at('14:40'))
  await page.goto('/events/2')
  await expect(page.getByTestId('checklist-badge')).toHaveText('2')
  await appSaved(page)
  await page.getByTestId('day-open-log').click()
  await page.getByTestId('checklist-tab').click()
  const toDo = page.getByTestId('not-on-checklist').locator('li')
  await expect(toDo).toHaveCount(2)
  await expect(toDo.nth(0)).toContainText('Elegant Trogon')
  await persisted(page, '"event-log"')

  await goOffline(context)
  await page.getByRole('button', { name: 'Elegant Trogon is on my checklist' }).click()
  await expect(toDo).toHaveCount(1)
  await expect(page.getByTestId('on-checklist')).toContainText('Elegant Trogon')
  await persisted(page, '"op":"mark"')
  await page.reload()
  await page.getByTestId('checklist-tab').click()
  await expect(page.getByTestId('on-checklist')).toContainText('Elegant Trogon')
  expect(api.marks.size).toBe(0)
  await goOnline(context)
  await expect.poll(() => [...api.marks], { timeout: 15_000 }).toEqual([1])

  await page.getByRole('button', { name: 'Take Elegant Trogon off my checklist list' }).click()
  await expect(toDo).toHaveCount(2)
  await expect.poll(() => api.marks.size, { timeout: 15_000 }).toBe(0)
  await page.getByRole('link', { name: 'Back to the event' }).click()
  await expect(page.getByTestId('checklist-badge')).toHaveText('2')
})

test('taking a bird off asks first, offers Undo, and keeps the first finder', async ({ page, context }) => {
  const api = await dayApi(context)
  await setClock(page, at('14:40'))
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('tally-count')).toContainText('3 species')
  await page.getByRole('button', { name: 'No thanks' }).click()
  await page.getByRole('button', { name: 'Take Elegant Trogon off the tally' }).click()
  await expect(page.getByText('Take it off for everyone?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('tally-count')).toContainText('3 species')

  await page.getByRole('button', { name: 'Take Elegant Trogon off the tally' }).click()
  await page.getByRole('button', { name: 'Take off', exact: true }).click()
  await expect(page.getByTestId('tally-count')).toContainText('2 species')
  await expect.poll(() => api.calls.filter(c => c === 'DELETE event-tally').length, { timeout: 10_000 }).toBe(1)
  await page.getByTestId('undo-toast').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('tally-count')).toContainText('3 species')
  await expect(page.locator('.event-tally__list li', { hasText: 'Elegant Trogon' })).toContainText('Jane · 6:10 AM')
  await expect.poll(() => api.calls.filter(c => c === 'POST event-tally-undo').length, { timeout: 10_000 }).toBe(1)

  // Offline: taken off and put back before it was ever sent, so nothing goes out.
  await appSaved(page)
  await goOffline(context)
  await page.getByRole('button', { name: 'Take Elegant Trogon off the tally' }).click()
  await page.getByRole('button', { name: 'Take off', exact: true }).click()
  await page.getByTestId('undo-toast').last().getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.event-tally__list li', { hasText: 'Elegant Trogon' })).toContainText('Jane')
  await expect(page.getByTestId('sync-badge')).toHaveCount(0)
  await goOnline(context)
  await page.waitForTimeout(1500)
  expect(api.calls.filter(c => c === 'DELETE event-tally').length).toBe(1)

  // Adding a bird that's already there says who has it.
  await page.locator('.event-tally__add input').fill('Elegant')
  await page.locator('.event-tally__add input').press('Enter')
  await expect(page.getByText('Already on the tally (Jane · 6:10 AM)')).toBeVisible()
})

test('with location allowed, an add carries where it was seen, to 3 decimals', async ({ page, context }) => {
  const api = await dayApi(context)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 31.446649, longitude: -110.306612 })
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('location-ask')).toContainText('so the group log shows where each bird was seen')
  await page.getByRole('button', { name: 'Allow' }).click()
  await expect(page.getByTestId('location-ask')).toHaveCount(0)
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '+ Hepatic Tanager' }).click()
  await expect.poll(() => api.posts.length, { timeout: 10_000 }).toBe(1)
  expect(api.posts[0]).toMatchObject({ species_code: 'heptan', lat: 31.447, lng: -110.307 })
  expect(api.posts[0]!.observed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test('the shared position shows another member\'s tap, and follows it on refresh', async ({ page, context }) => {
  const api = await dayApi(context)
  api.position = { stop: 1, at: at('13:05').toISOString(), by_name: 'Sam', by_you: false }
  await setClock(page, at('13:20'))
  await page.goto('/events/2')
  await expect(page.getByTestId('group-position')).toHaveText('Now at Carr Canyon · Sam, 6:05 AM')
  await expect(page.getByTestId('stop-now')).toContainText('Carr Canyon')
  await expect(page.getByTestId('stop-timer')).toHaveText('15 of 30 min')
  // Sam moves on; waking the phone picks it up.
  api.position = { stop: 2, at: at('13:25').toISOString(), by_name: 'Sam', by_you: false }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByTestId('group-position')).toHaveText('Now at Miller Canyon · Sam, 6:25 AM', { timeout: 35_000 })
})

test('a tap with no signal waits, survives a reload, and is sent once with its tap time', async ({ page, context }) => {
  const api = await dayApi(context)
  await setClock(page, at('13:00'))
  await page.goto('/events/2')
  await expect(page.getByTestId('start-day')).toBeVisible()
  await appSaved(page)
  await persisted(page, '"event-route-plan"')
  await goOffline(context)
  await page.getByTestId('start-day').click()
  await expect(page.getByTestId('group-position')).toContainText('Now at Sierra Vista Walmart · you, 6:00 AM')
  await expect(page.getByTestId('position-waiting')).toHaveText('Waiting for signal to send')
  await persisted(page, '"event-position"')
  await page.reload()
  await expect(page.getByTestId('position-waiting')).toBeVisible()
  expect(api.positionPosts).toHaveLength(0)
  await goOnline(context)
  await expect(page.getByTestId('position-waiting')).toHaveCount(0, { timeout: 20_000 })
  expect(api.positionPosts).toEqual([{ stop: -1, at: at('13:00').toISOString() }])
  await expect(page.getByTestId('group-position')).toHaveText('Now at Sierra Vista Walmart · you, 6:00 AM')
})

test('an older offline tap does not override a newer one: the server decides, and the page shows its answer', async ({ page, context }) => {
  const api = await dayApi(context)
  await setClock(page, at('13:30'))
  await page.goto('/events/2')
  await expect(page.getByTestId('start-day')).toBeVisible()
  await appSaved(page)
  await persisted(page, '"event-route-plan"')
  await goOffline(context)
  // Matt taps "Start the day" at 6:30 with no signal …
  await page.getByTestId('start-day').click()
  await expect(page.getByTestId('position-waiting')).toBeVisible()
  // … while Sam, with signal, marked Miller Canyon at 6:40.
  api.position = { stop: 2, at: at('13:40').toISOString(), by_name: 'Sam', by_you: false }
  await goOnline(context)
  await expect(page.getByTestId('position-waiting')).toHaveCount(0, { timeout: 20_000 })
  expect(api.positionPosts).toHaveLength(1)
  await expect(page.getByTestId('group-position')).toHaveText('Now at Miller Canyon · Sam, 6:40 AM')
})
