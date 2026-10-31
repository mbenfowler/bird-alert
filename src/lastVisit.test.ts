import { afterEach, describe, expect, it } from 'vitest'
import { isNewSince, obsTime, previousVisit, recordVisit, resetPreviousVisit } from './lastVisit'

describe('last visit', () => {
  afterEach(() => { localStorage.clear(); resetPreviousVisit() })

  it('nothing is new on a first visit', () => {
    expect(previousVisit()).toBeNull()
    expect(isNewSince('2026-10-30 08:00', previousVisit())).toBe(false)
  })

  it('a sighting after the previous visit ended is new, one before it is not', () => {
    recordVisit(new Date(2026, 9, 30, 7, 0).getTime())
    const since = previousVisit()
    expect(isNewSince('2026-10-30 08:00', since)).toBe(true)
    expect(isNewSince('2026-10-30 06:59', since)).toBe(false)
    expect(isNewSince('not a date', since)).toBe(false)
  })

  it('reads the previous visit once, so marks stay put while the page is open', () => {
    recordVisit(1000)
    expect(previousVisit()).toBe(1000)
    recordVisit(5000)
    expect(previousVisit()).toBe(1000)
  })

  it('reads eBird times as local time', () => {
    expect(obsTime('2026-10-30 08:15')).toBe(new Date(2026, 9, 30, 8, 15).getTime())
    expect(obsTime('2026-10-30')).toBe(new Date(2026, 9, 30).getTime())
  })
})
