import { describe, expect, it } from 'vitest'
import { parseCoordinates } from './coordinates'

describe('parseCoordinates', () => {
  it('reads a comma or a space between latitude and longitude', () => {
    expect(parseCoordinates('31.95, -109.31')).toEqual({ lat: 31.95, lng: -109.31 })
    expect(parseCoordinates(' 31.95 -109.31 ')).toEqual({ lat: 31.95, lng: -109.31 })
    expect(parseCoordinates('-33.9,18.4')).toEqual({ lat: -33.9, lng: 18.4 })
  })
  it('turns down anything else', () => {
    expect(parseCoordinates('Portal, AZ')).toBeNull()
    expect(parseCoordinates('95, 10')).toBeNull()
    expect(parseCoordinates('31.95, -190')).toBeNull()
    expect(parseCoordinates('31.95')).toBeNull()
    expect(parseCoordinates('123 Main St')).toBeNull()
  })
})
