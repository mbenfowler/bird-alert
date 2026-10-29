import { describe, expect, it } from 'vitest'
import { countryOf, countyName, countyWord, stateName, stateOfRegion, subnational1 } from './usStates'

describe('states and provinces', () => {
  it('tells a province from a state and builds eBird codes for both', () => {
    expect(countryOf('ON')).toBe('CA')
    expect(countryOf('GA')).toBe('US')
    expect(subnational1('QC')).toBe('CA-QC')
    expect(subnational1('GA')).toBe('US-GA')
    expect(stateName('BC')).toBe('British Columbia')
    expect(stateName('ME')).toBe('Maine')
  })
  it('reads the state from a county or census-division code, and nothing else', () => {
    expect(stateOfRegion('US-GA-139')).toBe('GA')
    expect(stateOfRegion('CA-ON-TO')).toBe('ON')
    expect(stateOfRegion('CA-ZZ-TO')).toBeNull()
    expect(stateOfRegion('US-GA')).toBeNull()
  })
  it('names a Canadian area plainly and a US county as a county', () => {
    expect(countyName('Toronto', 'ON')).toBe('Toronto')
    expect(countyName('Hall', 'GA')).toBe('Hall County')
    expect(countyWord('ON')).toBe('area')
    expect(countyWord('GA')).toBe('county')
  })
})
