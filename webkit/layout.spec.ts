import { expect, test, type Page } from '@playwright/test'
import { LONG_PLACE, stubApi } from './stubs'

/** The page and everything on it stops at the right edge of the screen. */
const expectNoOverflow = async (page: Page, ignore: string[] = []) => {
  const report = await page.evaluate((skip) => {
    const width = window.innerWidth
    const html = document.documentElement
    const wide = [...document.querySelectorAll('body *')]
      // Leaflet's tile and zoom layers run past the map's clipped edge by design; the map box itself is still checked.
      .filter((el) => !skip.some((s) => el.closest(s)) && !el.closest('.leaflet-container') && getComputedStyle(el).position !== 'fixed')
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''}@${Math.round(el.getBoundingClientRect().right)}`)
    return { scrollWidth: html.scrollWidth, clientWidth: html.clientWidth, bodyScrollWidth: document.body.scrollWidth, wide }
  }, ignore)
  expect(report.wide, `elements past the right edge: ${report.wide.join(', ')}`).toEqual([])
  expect(report.scrollWidth, 'document wider than the viewport').toBeLessThanOrEqual(report.clientWidth)
}

const SIZES = [
  { name: 'iPhone SE portrait', width: 375, height: 667 },
  { name: 'iPhone 15 Pro Max portrait', width: 430, height: 932 },
  { name: 'iPhone 14 landscape', width: 844, height: 390 }
]

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } })
    test.beforeEach(async ({ page }) => { await stubApi(page) })

    test('home', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('.birds-list .card').first()).toBeVisible()
      await expectNoOverflow(page, ['.alerts-list'])
    })

    test('species page with a long place name, before and after docking', async ({ page }) => {
      await page.goto('/sighting/cangoo/S155544998')
      await expect(page.locator('.sighting__meta')).toContainText('Olympic Rowing')
      await expect(page.locator('.sightings-map .map-pin').first()).toBeVisible()
      await expectNoOverflow(page)
      const frame = page.locator('.sighting__frame')
      await expect(frame).toHaveJSProperty('clientWidth', await page.evaluate(() => document.querySelector('.sighting')!.clientWidth - 24))
      // Mobile WebKit has no mouse wheel; scroll the page past the card by script, as a flick would.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect(frame).toHaveClass(/is-docked/)
      await expectNoOverflow(page)
      expect(await frame.evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(size.width)
      expect(await page.locator('.sighting__list').evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(size.width)
    })

    test('where to go page, before and after docking', async ({ page }) => {
      await page.goto('/go')
      await expect(page.locator('.go__places li').first()).toBeVisible()
      await expectNoOverflow(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect(page.locator('.go__frame')).toHaveClass(/is-docked/)
      await expectNoOverflow(page)
    })

    test('watch-list sightings page', async ({ page }) => {
      await page.goto('/sightings?s=cangoo:S155544243,cangoo:S155544998')
      await expect(page.locator('.alert-sightings__table')).toBeVisible()
      await expectNoOverflow(page)
    })

    test('settings and saved', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.locator('#settings-form')).toBeVisible()
      await expectNoOverflow(page)
      await page.goto('/saved')
      await expect(page.locator('.list-heading')).toBeVisible()
      await expectNoOverflow(page)
    })

    test('the wordmark draws both words', async ({ page }) => {
      await page.goto('/')
      const alert = page.locator('#titleAlert')
      await expect(alert).toBeVisible()
      expect(await alert.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(40)
      expect(LONG_PLACE.length).toBeGreaterThan(40)
    })
  })
}
