import type { Recap, RecapLifer, RecapTimelineRow } from '../../types'
import { clockTimeIn, formatLocale, t } from '../../i18n'
import { sunTimes } from '../../solar'
import { safeZone, zoneOffsetMin, zonedDay, zonedHhmm, zonedInstant } from '../Events/daySchedule'

/**
 * An event's recap worked out for the page: the curve's frame and its points, the stop bands, the
 * hour marks, the bird nearest a finger, the sunrise-to-sunset strip, and how names read to members
 * and to the public. Pure, so the maths is tested on its own.
 */

// ---- a thin or odd answer still draws ----

const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : [])
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const orNull = <T,>(value: T | null | undefined): T | null => (value && typeof value === 'object' ? value : null)

/** Every list a list and every count a number, whatever the server left out. */
export const normalizeRecap = (raw: Recap): Recap => {
  const totals = (raw.totals ?? {}) as Partial<Recap['totals']>
  const timeline = list<RecapTimelineRow>(raw.timeline).filter(row => row && typeof row.at === 'string' && !Number.isNaN(Date.parse(row.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return {
    ...raw,
    audience: raw.audience === 'public' ? 'public' : 'members',
    status: raw.status === 'sealed' ? 'sealed' : 'open',
    fixesUntil: typeof raw.fixesUntil === 'string' ? raw.fixesUntil : null,
    totals: {
      species: num(totals.species, timeline.length),
      stops: num(totals.stops),
      miles: typeof totals.miles === 'number' ? totals.miles : null,
      fieldMinutes: typeof totals.fieldMinutes === 'number' ? totals.fieldMinutes : null,
      firstBird: orNull(totals.firstBird) && totals.firstBird!.speciesCode ? totals.firstBird! : null,
      lastBird: orNull(totals.lastBird) && totals.lastBird!.speciesCode ? totals.lastBird! : null,
      bestStop: orNull(totals.bestStop),
      bestHour: orNull(totals.bestHour)
    },
    // Numbered in the order found, whatever the server sent.
    timeline: timeline.map((row, i) => ({ ...row, n: i + 1, liferFor: Array.isArray(row.liferFor) ? row.liferFor : null })),
    lifers: list<RecapLifer>(raw.lifers),
    highlights: { rarest: orNull(raw.highlights?.rarest), scoutingCalled: orNull(raw.highlights?.scoutingCalled) },
    targets: { total: num(raw.targets?.total), found: num(raw.targets?.found), missed: list<string>(raw.targets?.missed) },
    stops: list<Recap['stops'][number]>(raw.stops).filter(s => Number.isFinite(s?.lat) && Number.isFinite(s?.lng)),
    route: { miles: typeof raw.route?.miles === 'number' ? raw.route.miles : null, line: Array.isArray(raw.route?.line) && raw.route.line.length > 1 ? raw.route.line : null },
    members: list(raw.members),
    byMember: list(raw.byMember),
    together: typeof raw.together === 'number' ? raw.together : null,
    candidates: list(raw.candidates)
  }
}

export const isBigDay = (recap: Recap) => recap.event.kind === 'big_day' || recap.event.kind === 'bigday'
export const oneDay = (recap: Recap) => isBigDay(recap) || recap.event.startsOn === recap.event.endsOn

// ---- time in the event's own zone ----

/** The event's zone, else the phone's. */
export const zoneOf = (recap: Recap) => safeZone(recap.event.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone

const dayIndex = (day: string) => { const [y, m, d] = day.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d) / 86_400_000 }

/** Minutes from midnight of the first day (in the zone) to a moment: 7:31 AM on day one is 451. */
export const clockMin = (at: string | Date, zone: string, startsOn: string) => {
  const date = typeof at === 'string' ? new Date(at) : at
  const [h, m] = zonedHhmm(date, zone).split(':').map(Number) as [number, number]
  return (dayIndex(zonedDay(date, zone)) - dayIndex(startsOn)) * 1440 + h * 60 + m
}

/** The moment `min` minutes after midnight of the first day. */
export const atClockMin = (min: number, zone: string, startsOn: string) => {
  const days = Math.floor(min / 1440)
  const rest = min - days * 1440
  const day = new Date((dayIndex(startsOn) + days) * 86_400_000).toISOString().slice(0, 10)
  return zonedInstant(day, `${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}`, zone)
}

// ---- the curve ----

/** The chart's own units: the SVG's viewBox, stretched to the box, with all its words laid over it as HTML. */
export const VIEW = { w: 940, h: 245, left: 40, right: 910, base: 240, top: 40 } as const

export interface CurveFrame {
  /** Minutes from midnight of the first day, on whole hours. */
  start: number
  end: number
  /** The count at the top of the line. */
  max: number
  x: (min: number) => number
  y: (n: number) => number
}

/** From the first bird's hour to the last one's (5 AM to 8 PM with no birds), and from none to the day's count. */
export const curveFrame = (mins: number[], species: number): CurveFrame => {
  const start = mins.length ? Math.floor(Math.min(...mins) / 60) * 60 : 300
  let end = mins.length ? Math.ceil(Math.max(...mins) / 60) * 60 : 1200
  if (end - start < 60) end = start + 60
  const max = Math.max(species, 1)
  return {
    start, end, max,
    x: (min) => VIEW.left + ((min - start) / (end - start)) * (VIEW.right - VIEW.left),
    y: (n) => VIEW.base - (n / max) * (VIEW.base - VIEW.top)
  }
}

export interface CurvePoint { x: number; y: number; row: RecapTimelineRow; min: number }

export const curvePoints = (recap: Recap, frame: CurveFrame, zone: string): CurvePoint[] =>
  recap.timeline.map(row => {
    const min = clockMin(row.at, zone, recap.event.startsOn)
    return { x: frame.x(min), y: frame.y(row.n), row, min }
  })

/** Light grid lines at round counts: 30, 60, 90 for a day of 92; three or so, never above the top. */
export const gridLines = (species: number) => {
  const steps = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 500]
  const step = steps.find(s => species / s <= 3.5) ?? Math.ceil(species / 3)
  const lines: number[] = []
  for (let n = step; n <= species; n += step) lines.push(n)
  return lines
}

/** The hour (or, over days, the midnight) marks: every hour of a short outing, every other hour of a long day. Minor ones hide on a phone. */
export const timeTicks = (frame: Pick<CurveFrame, 'start' | 'end'>) => {
  const span = frame.end - frame.start
  const step = span > 36 * 60 ? 1440 : span > 8 * 60 ? 120 : 60
  const first = step === 1440 ? Math.ceil(frame.start / 1440) * 1440 : frame.start
  const ticks: { min: number; major: boolean; daily: boolean }[] = []
  for (let min = first, i = 0; min <= frame.end; min += step, i += 1) ticks.push({ min, major: i % 2 === 0, daily: step === 1440 })
  return ticks
}

export interface StopBand { index: number; name: string; x0: number; x1: number; best: boolean }

/** Each stop as a shaded band, from arriving to leaving, or else across the birds found there. */
export const stopBands = (recap: Recap, frame: CurveFrame, points: CurvePoint[], zone: string): StopBand[] =>
  recap.stops.flatMap(stop => {
    const here = points.filter(p => p.row.stopIndex === stop.index).map(p => p.min)
    const from = stop.arrive ? clockMin(stop.arrive, zone, recap.event.startsOn) : here.length ? Math.min(...here) : null
    if (from === null) return []
    const to = stop.arrive && stop.stayMin ? from + stop.stayMin : here.length ? Math.max(...here, from + 10) : from + 10
    const x0 = Math.max(VIEW.left, frame.x(from))
    const x1 = Math.min(VIEW.right, frame.x(to))
    if (x1 <= x0) return []
    return [{ index: stop.index, name: stop.name, x0, x1, best: recap.totals.bestStop?.index === stop.index }]
  })

/** The bird whose point is nearest across (`vx`, in viewBox units); points run left to right. */
export const nearestIndex = (points: Pick<CurvePoint, 'x'>[], vx: number) => {
  if (!points.length) return -1
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid]!.x < vx) lo = mid + 1
    else hi = mid
  }
  // lo is the first at or past vx; the one before may be nearer (a tie goes to the earlier bird).
  if (lo > 0 && vx - points[lo - 1]!.x <= points[lo]!.x - vx) return lo - 1
  return lo
}

/** Where the bird's label sits: beside the dot near either edge, centred elsewhere; below a dot high on the curve, above one low on it. */
export const tipPlacement = (xPct: number, y: number) => {
  const across = xPct < 22 ? '-8%' : xPct > 78 ? '-92%' : '-50%'
  const below = y < VIEW.h / 2
  return { transform: `translate(${across}, ${below ? '16px' : 'calc(-100% - 16px)'})`, below, side: xPct < 22 ? 'right' : xPct > 78 ? 'left' : 'centre' } as const
}

export const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`

/** The hour in which the most new birds came: "+14 from 7 to 8 AM", placed under the line there. */
export const bestHourNote = (recap: Recap, frame: CurveFrame, points: CurvePoint[]) => {
  const best = recap.totals.bestHour
  if (!best || !/^\d{1,2}:\d{2}$/.test(best.start)) return null
  const [h, m] = best.start.split(':').map(Number) as [number, number]
  const from = h * 60 + m
  const mid = from + 30
  if (mid < frame.start || mid > frame.end) return null
  const after = points.filter(p => p.min <= from + 60)
  const y = after.length ? after[after.length - 1]!.y : VIEW.base
  return { x: frame.x(from + 60), y, from, added: best.added }
}

// ---- the day, sunrise to sunset ----

export interface DayStrip {
  sunrise: Date | null
  sunset: Date | null
  /** Where each falls across the strip, 0-100. */
  at: { sunrise: number | null; sunset: number | null; first: number | null; last: number | null; noon: number }
  start: number
  end: number
}

/**
 * One day from 5 AM to 8 PM (wider when the birding was), the sun's hours lit, the first and last
 * birds marked. The sun from the event's place and date (src/solar.ts), in its own zone.
 */
export const dayStrip = (recap: Recap, zone: string): DayStrip | null => {
  const { lat, lng, startsOn } = recap.event
  const first = recap.totals.firstBird?.at ?? recap.timeline[0]?.at ?? null
  const last = recap.totals.lastBird?.at ?? recap.timeline[recap.timeline.length - 1]?.at ?? null
  const firstMin = first ? clockMin(first, zone, startsOn) : null
  const lastMin = last ? clockMin(last, zone, startsOn) : null
  let sunrise: Date | null = null
  let sunset: Date | null = null
  if (typeof lat === 'number' && typeof lng === 'number') {
    const offset = zoneOffsetMin(zonedInstant(startsOn, '12:00', zone), zone)
    const sun = sunTimes(startsOn, lat, lng, offset)
    sunrise = sun.sunrise
    sunset = sun.sunset
  }
  const sunriseMin = sunrise ? clockMin(sunrise, zone, startsOn) : null
  const sunsetMin = sunset ? clockMin(sunset, zone, startsOn) : null
  const start = Math.min(300, ...[firstMin, sunriseMin].filter((m): m is number => m !== null).map(m => Math.floor(m / 60) * 60))
  const end = Math.max(1200, ...[lastMin, sunsetMin].filter((m): m is number => m !== null).map(m => Math.ceil(m / 60) * 60))
  const place = (m: number | null) => (m === null ? null : Math.max(0, Math.min(100, ((m - start) / (end - start)) * 100)))
  return { sunrise, sunset, start, end, at: { sunrise: place(sunriseMin), sunset: place(sunsetMin), first: place(firstMin), last: place(lastMin), noon: place(720)! } }
}

// ---- names: the members' view and the public one ----

/** "Kirin and Matt", "Ana, Kirin and Matt", in the reader's language. */
type ListFormat = new (locale: string, options: { style: 'long'; type: 'conjunction' }) => { format: (items: string[]) => string }
export const nameList = (names: string[]) => {
  // Not in this project's TypeScript lib yet; every browser the app supports has it.
  const Format = (Intl as unknown as { ListFormat?: ListFormat }).ListFormat
  try { if (Format) return new Format(formatLocale(), { style: 'long', type: 'conjunction' }).format(names) } catch { /* below */ }
  return names.join(', ')
}

/** The gold line under a lifer on the curve: whose lifer it was, or for the public, the group's. */
export const liferLine = (row: Pick<RecapTimelineRow, 'lifer' | 'liferFor'>, audience: Recap['audience']) => {
  if (!row.lifer) return null
  return audience === 'members' && row.liferFor?.length ? t('recap.liferFor', { names: nameList(row.liferFor) }) : t('recap.liferGroup')
}

/** Under a lifer card: "Kirin’s lifer #210"; to the public, just one of the group's. */
export const liferWho = (lifer: Pick<RecapLifer, 'who' | 'number'>, audience: Recap['audience']) => {
  if (audience === 'public' || !lifer.who) return t('recap.liferSomeone')
  return lifer.number ? t('recap.liferNumber', { name: lifer.who, number: lifer.number }) : t('recap.liferOf', { name: lifer.who })
}

/** Who went: "Matt (organizer) · Kirin", or for the public, no names. */
export const crewLine = (recap: Recap) => {
  if (recap.audience === 'public' || !recap.members?.length) return t('recap.crewPublic')
  return [...recap.members].sort((a, b) => Number(b.organizer) - Number(a.organizer))
    .map(m => (m.organizer ? t('events.organizer', { name: m.name }) : m.name)).join(' · ')
}

/** "Kirin 5 · Matt 2": lifers per person, most first (members only). */
export const liferTally = (recap: Recap) => {
  if (recap.audience === 'public') return null
  const counts = new Map<string, number>()
  for (const l of recap.lifers) if (l.who) counts.set(l.who, (counts.get(l.who) ?? 0) + 1)
  if (!counts.size) return null
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}`).join(' · ')
}

/**
 * The members' recap as its share link would show it, for a preview with no signal: no names and
 * nothing only members see. The server's own public view (which also leaves out personal spots) is
 * used whenever it can be fetched.
 */
export const redactForPublic = (recap: Recap): Recap => ({
  ...recap,
  audience: 'public',
  shareCode: undefined,
  members: [],
  byMember: [],
  together: null,
  candidates: [],
  timeline: recap.timeline.map(row => ({ ...row, liferFor: null })),
  lifers: recap.lifers.map(l => ({ ...l, who: null }))
})

/** "5:41 AM", in the event's zone. */
export const timeIn = (at: string | Date | null | undefined, zone: string) => (at ? clockTimeIn(typeof at === 'string' ? new Date(at) : at, zone) : '')

/** "Mon, Nov 10, 2026", for a day ('2026-11-10'). */
export const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(formatLocale(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** "Wed, Nov 12": the last day fixes are taken, in the event's zone. */
export const fixesDay = (iso: string, zone?: string | null) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  try { return new Date(iso).toLocaleDateString(formatLocale(), zone ? { ...options, timeZone: zone } : options) } catch { return new Date(iso).toLocaleDateString(formatLocale(), options) }
}
