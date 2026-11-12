import { beforeEach, describe, expect, it } from 'vitest'
import { FRESH_MS, freshAlerts, freshKey, noteFreshAlert, sightingsIn } from './freshAlerts'

describe('fresh alerts', () => {
  beforeEach(() => localStorage.clear())

  it('reads the sightings out of an alert’s link, one or a batch', () => {
    expect(sightingsIn('/sighting/rubrob/S409165054')).toEqual([{ code: 'rubrob', subId: 'S409165054' }])
    expect(sightingsIn('/sightings?s=dowwoo%3AS1%2Ceasblu%3AS2')).toEqual([{ code: 'dowwoo', subId: 'S1' }, { code: 'easblu', subId: 'S2' }])
    expect(sightingsIn('/map')).toEqual([])
    expect(sightingsIn(null)).toEqual([])
  })

  it('counts minutes from when the alert first came, makes its entrance for two minutes, and lets go after an hour', () => {
    const at = 1_000_000_000
    noteFreshAlert('/sighting/rubrob/S1', at)
    noteFreshAlert('/sighting/rubrob/S1', at + 5 * 60_000)
    expect(freshAlerts(at + 30_000).get(freshKey('rubrob', 'S1'))).toEqual({ minutes: 0, arriving: true })
    expect(freshAlerts(at + 12 * 60_000).get(freshKey('rubrob', 'S1'))).toEqual({ minutes: 12, arriving: false })
    expect(freshAlerts(at + FRESH_MS).size).toBe(0)
  })
})
