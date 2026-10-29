import { describe, expect, it } from 'vitest'
import { longDistance, shortDistance, unitFor } from './distance'

describe('distances', () => {
  it('uses kilometres for a Canadian province and miles for a US state or no state', () => {
    expect(unitFor('ON')).toBe('km')
    expect(unitFor('GA')).toBe('mi')
    expect(unitFor('')).toBe('mi')
    expect(unitFor(undefined)).toBe('mi')
  })

  it('converts the server’s miles to a tenth of a kilometre', () => {
    expect(shortDistance(4.8, 'mi')).toBe('4.8 mi')
    expect(shortDistance(4.8, 'km')).toBe('7.7 km')
    expect(longDistance(10, 'km')).toBe('16.1 kilometres')
    expect(longDistance(10, 'mi')).toBe('10 miles')
  })
})
