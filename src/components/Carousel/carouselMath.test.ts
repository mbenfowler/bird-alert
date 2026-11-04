import { describe, expect, it } from 'vitest'
import { CLONES, canReach, carouselMode, isClone, realIndex, settle, slideWidth, swipeStep, trackOrder, trackX, wrap } from './carouselMath'

describe('the carousel’s track', () => {
  it('wraps both ways', () => {
    expect(wrap(7, 7)).toBe(0)
    expect(wrap(-1, 7)).toBe(6)
    expect(wrap(-8, 7)).toBe(6)
    expect(wrap(3, 0)).toBe(0)
  })

  it('has copies of the last slides before and the first after', () => {
    expect(trackOrder(5)).toEqual([2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2])
    expect(trackOrder(0)).toEqual([])
    expect([0, 2, 3, 7, 8, 10].map(e => isClone(e, 5))).toEqual([true, true, false, false, true, true])
  })

  it('knows which slide a copy stands for, and settles onto the real one', () => {
    expect(realIndex(CLONES, 5)).toBe(0)
    // Past the last slide is a copy of the first; the jump lands on the same slide.
    expect(realIndex(CLONES + 5, 5)).toBe(0)
    expect(settle(CLONES + 5, 5)).toBe(CLONES)
    expect(settle(CLONES - 1, 5)).toBe(CLONES + 4)
    expect(settle(CLONES + 2, 5)).toBe(CLONES + 2)
  })

  it('loops seamlessly: next from the last slides onto a copy, then settles', () => {
    const n = 6
    const last = CLONES + n - 1
    expect(canReach(last + 1, n, 'wide')).toBe(true)
    expect(trackOrder(n)[last + 1]).toBe(0)
    expect(settle(last + 1, n)).toBe(CLONES)
    // Back from the first slides onto a copy of the last.
    expect(canReach(CLONES - 1, n, 'narrow')).toBe(true)
    expect(trackOrder(n)[CLONES - 1]).toBe(n - 1)
  })

  it('settles first when a move would run off the copies', () => {
    const n = 6
    const total = n + 2 * CLONES
    expect(canReach(total - 3, n, 'wide')).toBe(true)
    expect(canReach(total - 2, n, 'wide')).toBe(false)
    expect(canReach(total - 2, n, 'narrow')).toBe(true)
    expect(canReach(total - 1, n, 'narrow')).toBe(false)
    expect(canReach(0, n, 'narrow')).toBe(false)
  })
})

describe('the carousel’s layout', () => {
  it('shows three across when wide and fits them exactly', () => {
    expect(slideWidth(724, 'wide', 14)).toBe(232)
    expect(trackX(724, CLONES, 'wide', 14)).toBe(-CLONES * 246)
    expect(trackX(724, CLONES + 1, 'wide', 14) - trackX(724, CLONES, 'wide', 14)).toBe(-246)
  })

  it('centres one when narrow, at 72%, with its neighbours at both edges', () => {
    const w = slideWidth(400, 'narrow', 14)
    expect(w).toBeCloseTo(288)
    const x = trackX(400, CLONES, 'narrow', 14)
    const left = x + CLONES * (w + 14)
    expect(left).toBeCloseTo((400 - w) / 2)
    // The neighbours start inside the edges.
    expect(left - 14).toBeGreaterThan(0)
    expect(left + w + 14).toBeLessThan(400)
  })

  it('stays still when everything fits', () => {
    expect(carouselMode(900, 3)).toBe('static')
    expect(carouselMode(900, 4)).toBe('wide')
    expect(carouselMode(640, 6)).toBe('wide')
    expect(carouselMode(639, 2)).toBe('narrow')
    expect(carouselMode(400, 1)).toBe('static')
  })

  it('moves one slide on a long enough swipe, the way it went', () => {
    expect(swipeStep(-80, 288)).toBe(1)
    expect(swipeStep(80, 288)).toBe(-1)
    expect(swipeStep(30, 288)).toBe(0)
    expect(swipeStep(-40, 150)).toBe(1)
  })
})
