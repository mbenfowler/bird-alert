import { describe, expect, it } from 'vitest'
import { sunTimes } from './solar'

const AZ = -420
/** Minutes between an answer and a reference time (UTC ISO). */
const off = (got: Date | null, want: string) => Math.abs((got!.getTime() - new Date(want).getTime()) / 60_000)

describe('sunTimes (NOAA solar calculator)', () => {
  // Reference for Sierra Vista, AZ (31.5545, -110.3037) on Nov 10 2026, NOAA's equations as served by
  // sunrise-sunset.org: nautical dawn 5:50, civil dawn 6:20, sunrise 6:45, sunset 5:25 PM,
  // civil dusk 5:51 PM, nautical dusk 6:20 PM (MST).
  const sierraVista = sunTimes('2026-11-10', 31.5545, -110.3037, AZ)

  it('has sunrise and sunset for Sierra Vista within 2 minutes', () => {
    expect(off(sierraVista.sunrise, '2026-11-10T13:45:01Z')).toBeLessThanOrEqual(2)
    expect(off(sierraVista.sunset, '2026-11-11T00:25:17Z')).toBeLessThanOrEqual(2)
  })

  it('has civil and nautical twilight within 2 minutes', () => {
    expect(off(sierraVista.civilDawn, '2026-11-10T13:19:34Z')).toBeLessThanOrEqual(2)
    expect(off(sierraVista.civilDusk, '2026-11-11T00:50:44Z')).toBeLessThanOrEqual(2)
    expect(off(sierraVista.nauticalDawn, '2026-11-10T12:50:25Z')).toBeLessThanOrEqual(2)
    expect(off(sierraVista.nauticalDusk, '2026-11-11T01:19:53Z')).toBeLessThanOrEqual(2)
  })

  it('keeps the evening on the local day asked for, though it is the next day in UTC', () => {
    expect(sierraVista.sunset!.getTime()).toBeGreaterThan(sierraVista.sunrise!.getTime())
    expect(sierraVista.nauticalDawn! < sierraVista.civilDawn! && sierraVista.civilDawn! < sierraVista.sunrise!).toBe(true)
  })

  it('works east of Greenwich too (Paris, summer solstice)', () => {
    const paris = sunTimes('2026-06-21', 48.8566, 2.3522, 120)
    // NOAA: sunrise 5:47, sunset 21:58 CEST.
    expect(off(paris.sunrise, '2026-06-21T03:47:00Z')).toBeLessThanOrEqual(2)
    expect(off(paris.sunset, '2026-06-21T19:58:00Z')).toBeLessThanOrEqual(2)
  })

  it('says null when the sun never sets or rises', () => {
    const north = sunTimes('2026-06-21', 78.2, 15.6, 120)
    expect(north.sunrise).toBeNull()
    expect(north.sunset).toBeNull()
  })
})
