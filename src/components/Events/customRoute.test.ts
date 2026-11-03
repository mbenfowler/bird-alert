import { describe, expect, it } from 'vitest'
import { customRoute } from './customRoute'
import type { EventRoute } from '../../types'

const suggested: EventRoute = {
  from: null,
  stops: [
    { n: 1, locId: 'L1', locName: 'One', lat: 1, lng: 1, new_birds: [{ code: 'a' }, { code: 'b' }], leg_min: null, leg_mi: null, species: ['a', 'b'] },
    { n: 2, locId: 'L2', locName: 'Two', lat: 2, lng: 2, new_birds: [{ code: 'c' }], leg_min: 10, leg_mi: 5, species: ['b', 'c'] }
  ],
  extras: [{ locId: 'L3', locName: 'Three', lat: 3, lng: 3, new_birds: [{ code: 'd' }], add_min: 30, add_mi: 20, species: ['c', 'd'] }],
  names: { a: 'Bird A', b: 'Bird B', c: 'Bird C', d: 'Bird D' },
  total_min: 10, total_mi: 5, covered: 3, reported: 5, skipped: 0, geometry: [], routed: true
}
const point = (locId: string | null, name: string, lat: number) => ({ locId, name, lat, lng: lat })

describe('customRoute', () => {
  it('credits each stop with the birds it adds in visit order, and counts coverage', () => {
    const route = customRoute({ suggested, reported: [], stops: [point('L2', 'Two', 2), point('L1', 'One', 1), point('L3', 'Three', 3)], start: null, drive: null, driveFailed: false })
    expect(route.stops.map(s => s.new_birds.map(b => b.code))).toEqual([['b', 'c'], ['a'], ['d']])
    expect(route.stops[0].new_birds[0].comName).toBe('Bird B')
    expect([route.covered, route.reported]).toEqual([4, 5])
    expect(route.stops.map(s => s.n)).toEqual([1, 2, 3])
  })

  it('a typed place adds nothing; scouting reports stand in for places the suggestion never listed', () => {
    const reported = [{ code: 'e', comName: 'Bird E', locId: 'L9', obsDt: '2026-11-01 07:00' }]
    const route = customRoute({ suggested, reported, stops: [point(null, '123 Main St', 5), point('L9', 'Nine', 9)], start: null, drive: null, driveFailed: false })
    expect(route.stops.map(s => s.new_birds.map(b => b.comName))).toEqual([[], ['Bird E']])
    expect(route.stops[0].locId).toBe('')
  })

  it('takes legs and totals from the drive, from the start when there is one', () => {
    const drive = { minutes: 50, miles: 30, geometry: [[0, 0], [1, 1], [2, 2]] as [number, number][], legs: [{ minutes: 20, miles: 12 }, { minutes: 30, miles: 18 }] }
    const route = customRoute({ suggested, reported: [], stops: [point('L1', 'One', 1), point('L2', 'Two', 2)], start: { name: 'Home', lat: 0, lng: 0 }, drive, driveFailed: false })
    expect(route.stops.map(s => s.leg_min)).toEqual([20, 30])
    expect([route.total_min, route.total_mi, route.from]).toEqual([50, 30, { lat: 0, lng: 0 }])
    expect(route.geometry).toEqual(drive.geometry)
    const none = customRoute({ suggested, reported: [], stops: [], start: null, drive: null, driveFailed: false })
    expect([none.stops, none.covered, none.geometry]).toEqual([[], 0, []])
  })
})
