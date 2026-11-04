/**
 * Sunrise, sunset and twilight for a day and a place, worked out on the phone (no network): NOAA's
 * solar calculator (the "General Solar Position" equations of its spreadsheet, after Meeus), good to
 * about a minute at the latitudes birders go to. Times are instants (Date); show them in the
 * event's own time zone.
 */

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** The sun's place for a moment, as minutes of the equation of time and its declination (degrees). */
const sunAt = (julianDay: number) => {
  const T = (julianDay - 2451545) / 36525
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T)
    + Math.sin(rad(3 * M)) * 0.000289
  const omega = 125.04 - 1934.136 * T
  const apparentLong = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega))
  const meanObliquity = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(omega))
  const declination = deg(Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLong))))
  const y = Math.tan(rad(obliquity / 2)) ** 2
  const equationOfTime = 4 * deg(
    y * Math.sin(2 * rad(L0))
    - 2 * e * Math.sin(rad(M))
    + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
    - 0.5 * y * y * Math.sin(4 * rad(L0))
    - 1.25 * e * e * Math.sin(2 * rad(M))
  )
  return { equationOfTime, declination }
}

/** The sun's angle below the zenith at each moment: the edge of the disc at the horizon (with refraction), then 6° and 12° below. */
export const ZENITH = { sun: 90.833, civil: 96, nautical: 102 } as const

/**
 * Minutes after midnight UTC on the day when the sun crosses `zenith`, rising (morning) or setting;
 * null when it never does that day (polar day or night). Worked out twice, the second time for the
 * sun's place at the first answer.
 */
const crossing = (dayJd: number, lat: number, lng: number, zenith: number, rising: boolean): number | null => {
  let minutes = 720 - 4 * lng
  for (let pass = 0; pass < 3; pass += 1) {
    const { equationOfTime, declination } = sunAt(dayJd + minutes / 1440)
    const cosHA = Math.cos(rad(zenith)) / (Math.cos(rad(lat)) * Math.cos(rad(declination))) - Math.tan(rad(lat)) * Math.tan(rad(declination))
    if (cosHA > 1 || cosHA < -1) return null
    const hourAngle = deg(Math.acos(cosHA))
    const noon = 720 - 4 * lng - equationOfTime
    minutes = noon + (rising ? -4 : 4) * hourAngle
  }
  return minutes
}

export interface SunTimes {
  nauticalDawn: Date | null
  civilDawn: Date | null
  sunrise: Date | null
  sunset: Date | null
  civilDusk: Date | null
  nauticalDusk: Date | null
}

/**
 * The sun's day at a place: `day` is the local calendar day ('2026-11-10'), and `utcOffsetMin` the
 * place's offset from UTC that day (−420 for Arizona), so a place far west of Greenwich gets its own
 * morning, not the next one's.
 */
export const sunTimes = (day: string, lat: number, lng: number, utcOffsetMin = Math.round(lng / 15) * 60): SunTimes => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const midnightUtc = Date.UTC(y, m - 1, d)
  // Julian day at 0h UTC of the date.
  const dayJd = midnightUtc / 86_400_000 + 2440587.5
  const at = (zenith: number, rising: boolean) => {
    let minutes = crossing(dayJd, lat, lng, zenith, rising)
    if (minutes === null) return null
    // Keep the moment on the local day asked for.
    const local = minutes + utcOffsetMin
    if (local < 0) minutes += 1440
    else if (local >= 1440) minutes -= 1440
    return new Date(midnightUtc + Math.round(minutes * 60_000))
  }
  return {
    nauticalDawn: at(ZENITH.nautical, true),
    civilDawn: at(ZENITH.civil, true),
    sunrise: at(ZENITH.sun, true),
    sunset: at(ZENITH.sun, false),
    civilDusk: at(ZENITH.civil, false),
    nauticalDusk: at(ZENITH.nautical, false)
  }
}
