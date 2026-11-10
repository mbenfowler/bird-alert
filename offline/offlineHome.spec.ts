import { expect, test } from '@playwright/test'
import { appSaved, fakeApi, goOffline, today } from './fakeApi'

test.use({ viewport: { width: 375, height: 812 } })

test('on the day, opened with no signal and an account last checked the day before, home still leads with the tally', async ({ page, context }) => {
  const api = await fakeApi(context)
  // Yesterday's answer: the event is coming up, not on yet.
  api.userPatch = { activeEvent: null, upcomingEvent: { id: 2, name: 'Cochise Big Day', starts_on: today() } }
  await page.goto('/events')
  await expect(page.getByText('Cochise Big Day').first()).toBeVisible()
  await appSaved(page)
  await page.waitForFunction(() => (localStorage.getItem('bird-alert-query-cache') ?? '').includes('Cochise Big Day'))
  await goOffline(context)
  await page.goto('/')
  await expect(page.getByTestId('event-banner')).toContainText('Cochise Big Day')
  await page.getByTestId('event-banner').getByRole('link', { name: 'Open tally' }).click()
  await expect(page).toHaveURL(/\/events\/2\/tally$/)
  await expect(page.getByTestId('tally-count')).toBeVisible()
})
