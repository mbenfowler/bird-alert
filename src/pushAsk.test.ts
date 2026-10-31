import { describe, expect, it } from 'vitest'
import { MAX_DISMISSALS, QUIET_DAYS, shouldAsk, withArticle } from './pushAsk'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 1)
const fresh = { dismissals: 0, last: 0 }

describe('shouldAsk', () => {
  it('asks a device that could get alerts but doesn’t', () => {
    expect(shouldAsk({ push: 'off', iosTab: false, record: fresh, now })).toBe(true)
  })
  it('never asks when alerts are on, blocked or impossible here', () => {
    for (const push of ['on', 'denied', 'unsupported'] as const) expect(shouldAsk({ push, iosTab: false, record: fresh, now })).toBe(false)
  })
  it('asks an iPhone Safari tab, where the answer is the Home Screen app', () => {
    expect(shouldAsk({ push: 'unsupported', iosTab: true, record: fresh, now })).toBe(true)
  })
  it('keeps quiet for a week after "Not now", then asks again', () => {
    const record = { dismissals: 1, last: now - (QUIET_DAYS - 1) * DAY }
    expect(shouldAsk({ push: 'off', iosTab: false, record, now })).toBe(false)
    expect(shouldAsk({ push: 'off', iosTab: false, record: { ...record, last: now - (QUIET_DAYS + 1) * DAY }, now })).toBe(true)
  })
  it('stops for good after three', () => {
    expect(shouldAsk({ push: 'off', iosTab: true, record: { dismissals: MAX_DISMISSALS, last: now - 365 * DAY }, now })).toBe(false)
  })
})

describe('withArticle', () => {
  it('says a or an', () => {
    expect(withArticle('Painted Bunting')).toBe('a Painted Bunting')
    expect(withArticle('American Robin')).toBe('an American Robin')
  })
})
