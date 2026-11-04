import type { EventLogEntry, EventRoute, EventRoutePlan, EventTallyEntry, Id } from '../../types'

/**
 * The day itself, worked out on the phone so it all holds with no signal: the route the group is
 * driving, when it planned to be at each stop, how far behind it is, what is still to find at a
 * stop, the group log in the order birds were seen, and the birds still to put on one's checklist.
 */

// ---- the event's own time zone ----

const parts = (date: Date, timeZone: string) => {
  const out: Record<string, number> = {}
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Minutes the zone is ahead of UTC at that moment (−420 for Arizona). */
export const zoneOffsetMin = (date: Date, timeZone: string) => {
  const p = parts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
}

/** The calendar day in the zone at that moment, as '2026-11-10'. */
export const zonedDay = (date: Date, timeZone: string) => {
  const p = parts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** The moment it is `hhmm` ('05:30') on `day` in the zone. */
export const zonedInstant = (day: string, hhmm: string, timeZone: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const [h, min] = hhmm.split(':').map(Number) as [number, number]
  const wall = Date.UTC(y, m - 1, d, h, min)
  let guess = wall
  for (let i = 0; i < 2; i += 1) guess = wall - zoneOffsetMin(new Date(guess), timeZone) * 60_000
  return new Date(guess)
}

/** '05:30', the time of day in the zone (for a time input). */
export const zonedHhmm = (date: Date, timeZone: string) => {
  const p = parts(date, timeZone)
  return `${String(p.hour % 24).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** A time zone the browser knows, else the phone's own. */
export const safeZone = (timeZone: string | null | undefined) => {
  if (!timeZone) return undefined
  try { new Intl.DateTimeFormat('en-US', { timeZone }); return timeZone } catch { return undefined }
}

// ---- the route of the day ----

export interface DayStop {
  index: number
  locId: string | null
  name: string
  lat: number
  lng: number
  /** Minutes there: the group's, else the suggestion's. */
  stayMin: number
  /** The drive into it, from the stop before (or the meeting point); null when not known. */
  legMin: number | null
  legMi: number | null
  /** Every target reported here this week (the suggested route's list), when known. */
  species: string[]
}

export interface DayRoute {
  start: { name: string; lat: number; lng: number } | null
  stops: DayStop[]
  /** The group saved its own stops; else the suggestion stands. */
  custom: boolean
}

/** The route the group is driving: its own saved stops (with the server's drive times), else the suggested route. */
export const dayRoute = (plan: EventRoutePlan | undefined, suggested: EventRoute | undefined): DayRoute | null => {
  const start = plan?.start ?? null
  const speciesOf = (locId: string | null) => {
    if (!locId) return []
    const place = [...(suggested?.stops ?? []), ...(suggested?.extras ?? [])].find(p => p.locId === locId)
    return Array.isArray(place?.species) ? place.species : place && 'new_birds' in place ? place.new_birds.map(b => b.code) : []
  }
  if (plan?.stops) {
    return {
      start,
      custom: true,
      stops: plan.stops.map((stop, index) => {
        const leg = plan.legs?.[index] ?? null
        return {
          index, locId: stop.locId, name: stop.name, lat: stop.lat, lng: stop.lng,
          stayMin: stop.stay_min ?? stop.suggested_stay_min ?? 0,
          legMin: leg ? leg.min : null, legMi: leg ? leg.mi : null,
          species: speciesOf(stop.locId)
        }
      })
    }
  }
  if (!suggested || !Array.isArray(suggested.stops)) return plan ? { start, stops: [], custom: false } : null
  return {
    start,
    custom: false,
    stops: suggested.stops.map((stop, index) => ({
      index, locId: stop.locId || null, name: stop.locName, lat: stop.lat, lng: stop.lng,
      stayMin: stop.stay_min ?? stop.suggested_stay_min ?? 0,
      legMin: stop.leg_min, legMi: stop.leg_mi,
      species: Array.isArray(stop.species) ? stop.species : stop.new_birds.map(b => b.code)
    }))
  }
}

export interface Planned { arrive: Date; leave: Date }

/** When each stop was meant to be reached and left: from the start time, each drive, then each stay. */
export const plannedTimes = (stops: Pick<DayStop, 'legMin' | 'stayMin'>[], startAt: Date | null): Planned[] => {
  if (!startAt) return []
  let t = startAt.getTime()
  return stops.map(stop => {
    t += (stop.legMin ?? 0) * 60_000
    const arrive = new Date(t)
    t += stop.stayMin * 60_000
    return { arrive, leave: new Date(t) }
  })
}

// ---- where the group is (kept on this phone) ----

export interface DayProgress {
  /** The meeting time on the day, '05:30' in the event's zone, as set on this phone. */
  meetAt?: string | null
  /** "Start the day" was tapped. */
  startedAt?: string | null
  /** The stop the group is at (0-based), once "We're here" was tapped there. */
  at?: number | null
  arrivedAt?: string | null
}

const progressKey = (id: Id) => `bird-alert:event-day:${id}`

export const readProgress = (id: Id): DayProgress => {
  try {
    const value = JSON.parse(localStorage.getItem(progressKey(id)) ?? 'null') as unknown
    return value && typeof value === 'object' ? value as DayProgress : {}
  } catch { return {} }
}

export const writeProgress = (id: Id, progress: DayProgress) => {
  try { localStorage.setItem(progressKey(id), JSON.stringify(progress)) } catch { /* private mode: it lasts the visit */ }
}

/** Signing out forgets every event's progress (and the get-ready record) on this phone. */
export const clearDayProgress = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('bird-alert:event-day:') || key.startsWith('bird-alert:event-ready:')) localStorage.removeItem(key)
  } catch { /* nothing kept */ }
}

/** The day's clock starts at the meeting time when one is set, else when "Start the day" was tapped. */
export const scheduleStart = (progress: DayProgress, day: string, timeZone: string | undefined) => {
  if (progress.meetAt && /^\d{2}:\d{2}$/.test(progress.meetAt)) return zonedInstant(day, progress.meetAt, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  return progress.startedAt ? new Date(progress.startedAt) : null
}

export interface DayState {
  /** Not started; started and on the way to `next`; or at stop `at`. */
  phase: 'before' | 'driving' | 'at' | 'done'
  at: number | null
  next: number | null
  /** At a stop: minutes there so far, and its planned stay. */
  minutesHere: number | null
  stayMin: number | null
  over: boolean
  /** Minutes behind the plan (negative: ahead); null with no plan to compare against. */
  behindMin: number | null
}

const minutes = (ms: number) => Math.round(ms / 60_000)

/** Where the day stands now, against the plan. */
export const dayState = (stops: DayStop[], planned: Planned[], progress: DayProgress, now: Date, hasStart: boolean): DayState => {
  const at = typeof progress.at === 'number' && progress.at >= 0 && progress.at < stops.length ? progress.at : null
  if (at !== null) {
    const arrived = progress.arrivedAt ? new Date(progress.arrivedAt) : now
    const stay = stops[at]!.stayMin
    const here = Math.max(0, minutes(now.getTime() - arrived.getTime()))
    const projectedLeave = Math.max(now.getTime(), arrived.getTime() + stay * 60_000)
    const plan = planned[at]
    const last = at === stops.length - 1
    return {
      phase: 'at', at, next: last ? null : at + 1, minutesHere: here, stayMin: stay, over: here >= stay && stay > 0,
      behindMin: plan ? minutes(projectedLeave - plan.leave.getTime()) : null
    }
  }
  if (progress.startedAt) {
    // On the way to the first stop from the meeting point.
    const plan = planned[0]
    const startedAt = new Date(progress.startedAt).getTime()
    const projectedArrive = Math.max(now.getTime(), startedAt + (stops[0]?.legMin ?? 0) * 60_000)
    return { phase: 'driving', at: null, next: stops.length ? 0 : null, minutesHere: null, stayMin: null, over: false, behindMin: plan && hasStart ? minutes(projectedArrive - plan.arrive.getTime()) : null }
  }
  const startAt = planned[0] ? planned[0].arrive.getTime() - (stops[0]?.legMin ?? 0) * 60_000 : null
  return { phase: 'before', at: null, next: stops.length ? 0 : null, minutesHere: null, stayMin: null, over: false, behindMin: startAt !== null && now.getTime() > startAt ? minutes(now.getTime() - startAt) : null }
}

/** The stops after the current one that could be cut to catch up: the one adding the fewest birds still needed (the longer stay on a tie). */
export const trimSuggestion = (stops: DayStop[], after: number, neededAt: (stop: DayStop) => number): DayStop | null => {
  const later = stops.filter(stop => stop.index > after && stop.stayMin > 0)
  if (!later.length) return null
  return [...later].sort((a, b) => neededAt(a) - neededAt(b) || b.stayMin - a.stayMin)[0]!
}

/** Ten minutes either way is on schedule. */
export const BEHIND_SLACK_MIN = 10

/** The targets reported at a stop this week that nobody has on the tally yet. */
export const stillNeededAt = (stop: Pick<DayStop, 'species'>, targets: string[], tally: string[]) => {
  const got = new Set(tally)
  const wanted = new Set(targets)
  return stop.species.filter(code => wanted.has(code) && !got.has(code))
}

// ---- directions ----

/** Google Maps directions to one place, from wherever the phone is. */
export const googleDirections = (p: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`

/** Apple Maps directions to one place, from wherever the phone is. */
export const appleDirections = (p: { lat: number; lng: number }) => `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d`

// ---- the group log and the checklist keeper ----

/** Later than this after it was seen, a bird counts as sent in late (by someone out of signal). */
export const LATE_SYNC_MIN = 10

export interface LogRow {
  key: string
  code: string
  name: string | null
  by: string | null
  you: boolean
  observedAt: string
  stopName: string | null
  removed: boolean
  /** Reached the server well after it was seen. */
  late: boolean
  /** Made on this phone and not sent yet. */
  pending: boolean
}

/**
 * Every bird in the order it was seen: the server's log (removed ones too), with each one's arrival
 * time from the tally to spot the late ones, plus this phone's adds that haven't been sent. With no
 * log saved yet the tally stands in, so it reads the same offline.
 */
export const groupLog = (log: EventLogEntry[] | undefined, tally: (EventTallyEntry & { pending?: boolean; clientId?: string })[]): LogRow[] => {
  const byId = new Map(tally.filter(e => e.id !== undefined).map(e => [String(e.id), e]))
  const lateOf = (entry: EventTallyEntry | undefined) => Boolean(entry?.observed_at && entry.added_at
    && new Date(entry.added_at).getTime() - new Date(entry.observed_at).getTime() > LATE_SYNC_MIN * 60_000)
  const rows: LogRow[] = log
    ? log.map(entry => {
        const row = byId.get(String(entry.id))
        return {
          key: `log-${entry.id}`, code: entry.speciesCode, name: entry.comName ?? null, by: entry.by_name ?? null, you: Boolean(row?.added_by_you),
          observedAt: entry.observed_at, stopName: entry.stop_name ?? null, removed: Boolean(entry.removed), late: lateOf(row), pending: false
        }
      })
    : tally.filter(e => !e.pending).map(entry => ({
        key: `tally-${entry.id ?? entry.code}`, code: entry.code, name: null, by: entry.added_by_name ?? null, you: Boolean(entry.added_by_you),
        observedAt: entry.observed_at ?? entry.added_at, stopName: entry.stop_name ?? null, removed: false, late: lateOf(entry), pending: false
      }))
  // Birds on the tally the saved log hasn't caught up with yet, and this phone's unsent adds.
  const inLog = new Set(rows.filter(r => !r.removed).map(r => r.code))
  for (const entry of tally) {
    if (inLog.has(entry.code)) continue
    rows.push({
      key: entry.pending ? `pending-${entry.clientId ?? entry.code}` : `tally-${entry.id ?? entry.code}`, code: entry.code, name: null, by: entry.added_by_name ?? null, you: Boolean(entry.added_by_you),
      observedAt: entry.observed_at ?? entry.added_at, stopName: entry.stop_name ?? null, removed: false, late: lateOf(entry), pending: Boolean(entry.pending)
    })
  }
  return rows.sort((a, b) => a.observedAt.localeCompare(b.observedAt))
}

/** The birds others found that the checklist keeper hasn't ticked as on their own eBird checklist, in the order seen. */
export const notOnMyChecklist = <T extends EventTallyEntry & { pending?: boolean }>(tally: T[]): T[] =>
  tally.filter(entry => !entry.added_by_you && !entry.pending && entry.id !== undefined && !entry.marked_by_me)
    .sort((a, b) => (a.observed_at ?? a.added_at).localeCompare(b.observed_at ?? b.added_at))
