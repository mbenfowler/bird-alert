import { expect, test, type Page } from '@playwright/test'
import { fakeApi, goOffline, goOnline } from './fakeApi'

const CACHE_KEY = 'bird-alert-query-cache'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The worker controls the page and has finished saving the whole app. */
const appSaved = (page: Page) => page.waitForFunction(async () => {
  if (!navigator.serviceWorker.controller) return false
  for (const name of await caches.keys()) {
    if (name.startsWith('bird-alert-shell-') && await (await caches.open(name)).match('/__installed')) return true
  }
  return false
}, undefined, { timeout: 20_000 })

/** The saved query cache (localStorage) holds this text. */
const persisted = (page: Page, text: string) => page.waitForFunction(([key, needle]) => (localStorage.getItem(key) ?? '').includes(needle), [CACHE_KEY, text] as const)

/** Makes the saved session look an hour old, so the next launch checks it with the server. */
const ageSession = (page: Page) => page.evaluate((key) => {
  const saved = JSON.parse(localStorage.getItem(key)!)
  for (const query of saved.clientState.queries) if (query.queryKey[0] === 'session') query.state.dataUpdatedAt = Date.now() - 3600_000
  localStorage.setItem(key, JSON.stringify(saved))
}, CACHE_KEY)

const pendingRow = (page: Page, name: string) => page.locator('.event-tally__list li[data-pending="true"]', { hasText: name })

test('with no signal the app opens from what was saved: deep links, the tally, and a page never opened', async ({ page, context }) => {
  await fakeApi(context)
  await page.goto('/events/2')
  await expect(page.getByRole('heading', { name: 'Cochise Big Day' })).toBeVisible()
  await appSaved(page)
  await persisted(page, '"events"')

  await goOffline(context)
  const tally = await page.goto('/events/2/tally')
  expect(tally?.fromServiceWorker()).toBe(true)
  await expect(page.getByTestId('tally-count')).toContainText('1 species')
  await expect(page.getByTestId('offline-note')).toContainText('Offline · showing what was saved at')
  await expect(page).toHaveURL(/\/events\/2\/tally$/)

  const detail = await page.goto('/events/2')
  expect(detail?.fromServiceWorker()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Cochise Big Day' })).toBeVisible()

  // The Events list was never opened: its code comes from the worker's saved copy.
  await page.getByRole('link', { name: 'All events' }).click()
  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByTestId('events-upcoming')).toContainText('Cochise Big Day')
  await expect(page.getByText('This page could not be loaded')).toHaveCount(0)
})

test('a bird added with no signal survives a reload and is sent once, with its client_id, when signal returns', async ({ page, context }) => {
  const api = await fakeApi(context)
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('tally-count')).toContainText('1 species')
  await appSaved(page)
  await persisted(page, '"events"')

  await goOffline(context)
  await page.getByRole('button', { name: '+ Hepatic Tanager' }).click()
  await expect(pendingRow(page, 'Hepatic Tanager')).toBeVisible()
  await expect(page.getByTestId('sync-badge')).toHaveText('1 waiting to sync')
  await expect(page.getByTestId('tally-count')).toContainText('2 species')
  await persisted(page, '"event-tally"')

  await page.reload()
  await expect(pendingRow(page, 'Hepatic Tanager')).toBeVisible()
  await expect(page.getByTestId('sync-badge')).toHaveText('1 waiting to sync')
  expect(api.posts).toHaveLength(0)

  await goOnline(context)
  await expect(page.getByTestId('sync-badge')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.event-tally__list li', { hasText: 'Hepatic Tanager' })).not.toHaveAttribute('data-pending', 'true')
  await page.waitForTimeout(1500)
  expect(api.posts).toHaveLength(1)
  expect(api.posts[0]!.species_code).toBe('heptan')
  expect(api.posts[0]!.client_id).toMatch(UUID)
})

test('a pending add can be taken off before it is sent, and is never sent', async ({ page, context }) => {
  const api = await fakeApi(context)
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('tally-count')).toContainText('1 species')
  await goOffline(context)
  await page.getByRole('button', { name: '+ Hepatic Tanager' }).click()
  await expect(pendingRow(page, 'Hepatic Tanager')).toBeVisible()
  // Every other entry's × stays usable too.
  await expect(page.getByRole('button', { name: 'Take Elegant Trogon off the tally' })).toBeEnabled()
  await page.getByRole('button', { name: 'Take Hepatic Tanager off the tally' }).click()
  await page.getByRole('button', { name: 'Take off', exact: true }).click()
  await expect(page.locator('.event-tally__list li', { hasText: 'Hepatic Tanager' })).toHaveCount(0)
  await expect(page.getByTestId('sync-badge')).toHaveCount(0)
  await goOnline(context)
  await page.waitForTimeout(2000)
  expect(api.posts).toHaveLength(0)
})

test('on weak signal a failed add is retried until it gets through, with no raw browser error', async ({ page, context }) => {
  const api = await fakeApi(context)
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('tally-count')).toContainText('1 species')
  let attempts = 0
  api.interfere = (route) => {
    const request = route.request()
    if (request.method() !== 'POST' || !request.url().includes('kind=event-tally')) return
    attempts += 1
    if (attempts <= 2) return 'fail'
  }
  await page.getByRole('button', { name: '+ Hepatic Tanager' }).click()
  await expect(pendingRow(page, 'Hepatic Tanager')).toBeVisible()
  await expect(page.getByTestId('sync-badge')).toHaveText('1 waiting to sync')
  await expect(page.getByTestId('sync-badge')).toHaveCount(0, { timeout: 20_000 })
  expect(attempts).toBe(3)
  expect(api.posts).toHaveLength(1)
  await expect(page.locator('.event-tally__list li', { hasText: 'Hepatic Tanager' })).toBeVisible()
  await expect(page.getByText(/Failed to fetch|Load failed/)).toHaveCount(0)
})

test('a failed sign-in check keeps the member signed in; only a 401 signs out', async ({ page, context }) => {
  const api = await fakeApi(context)
  await page.goto('/events/2/tally')
  await expect(page.getByTestId('tally-count')).toContainText('1 species')
  await persisted(page, '"session"')

  api.meFails = true
  await ageSession(page)
  await page.reload()
  await expect(page.getByTestId('tally-count')).toContainText('1 species')
  await page.waitForTimeout(4000)
  await expect(page).toHaveURL(/\/events\/2\/tally$/)

  api.meFails = false
  api.loggedIn = false
  await ageSession(page)
  await page.reload()
  await expect(page).toHaveURL(/\/login\?next=/)
})

test('never signed in on this phone and no signal: says so instead of asking to log in', async ({ page, context }) => {
  const api = await fakeApi(context)
  api.meFails = true
  await page.goto('/events/2/tally')
  await expect(page.getByText('No signal. Bird Alert will check your sign-in once you’re back online.')).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/events\/2\/tally$/)
})

test('a dropped connection reads as no signal, never as "not on your list" or "link doesn\'t work"', async ({ page, context }) => {
  const api = await fakeApi(context)
  api.interfere = (route) => (/kind=(events|event-view)\b/.test(route.request().url()) ? 'fail' : undefined)
  await page.goto('/events/2/tally')
  await expect(page.getByText('No signal, and this isn’t saved on this phone yet.', { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('This event isn\'t on your list.')).toHaveCount(0)

  await page.goto('/events/view/view2')
  await expect(page.getByText('No signal, and this isn’t saved on this phone yet.', { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('This link doesn\'t work anymore.')).toHaveCount(0)
})

test('the worker still handles a push', async ({ page, context }) => {
  await fakeApi(context)
  await context.grantPermissions(['notifications'])
  await page.goto('/events/2')
  await appSaved(page)
  // Headless Chromium can't deliver a real push, so one is dispatched inside the worker. (An
  // untrusted event can't extend its lifetime, so waitUntil throws once the handler has run.)
  const [worker] = context.serviceWorkers()
  await worker!.evaluate(() => {
    const data = JSON.stringify({ title: 'Elegant Trogon', body: 'Cave Creek Canyon', url: '/events/2', tag: 'eletro' })
    try { self.dispatchEvent(new (self as unknown as { PushEvent: new (type: string, init: { data: string }) => Event }).PushEvent('push', { data })) } catch { /* see above */ }
  })
  // The push handler ran: it records the push for the page (src/notificationHandoff.ts) as it shows it.
  await expect.poll(() => page.evaluate(async () => {
    const record = await (await caches.open('bird-alert-pending-open')).match('/latest-push')
    return record ? ((await record.json()) as { title: string }).title : null
  })).toBe('Elegant Trogon')
})
