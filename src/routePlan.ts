import type { GoPlace } from './types'

/**
 * A route the person has made their own: the stops in their order, and where the day starts.
 * Kept in this browser only (per county for the stops, once for the start), which is all it needs:
 * the suggested route is always one tap away.
 */
export interface PlanPoint {
  /** The eBird hotspot, when it is one; a typed address has none. */
  locId: string | null
  name: string
  lat: number
  lng: number
  /** A line about a stop that is not among the watch list's places, e.g. "74 species all time · Lumpkin". */
  note?: string | null
}

export const MAX_ROUTE_STOPS = 8

const ROAD_FACTOR = 1.35
/** Kilometres between two points as the crow flies, times a typical road detour (as the server reckons). */
export const roadKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR
}

export const pathKm = (order: PlanPoint[], start: PlanPoint | null = null) => {
  const points = start ? [start, ...order] : order
  return points.slice(1).reduce((sum, p, i) => sum + roadKm(points[i], p), 0)
}

const permutations = <T,>(items: T[]): T[][] => items.length <= 1
  ? [items]
  : items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]))

/** The order with the least driving, from the start when there is one. Every order is tried (eight stops is 40,320). */
export const shortestOrder = (stops: PlanPoint[], start: PlanPoint | null = null) => {
  if (stops.length <= 1) return stops
  let best = stops
  let bestKm = pathKm(stops, start)
  for (const order of permutations(stops)) {
    const km = pathKm(order, start)
    if (km < bestKm - 1e-9) { best = order; bestKm = km }
  }
  return best
}

/**
 * The order with the least driving when some stops are locked in place: each locked stop keeps its
 * position, and only the others are tried in the free positions (every order: eight stops is at
 * most 40,320). Distances are straight lines times a road factor, as `shortestOrder`.
 */
export const shortestOrderLocked = <T extends PlanPoint>(stops: T[], locked: boolean[], start: PlanPoint | null = null): T[] => {
  if (!locked.some(Boolean)) return shortestOrder(stops, start) as T[]
  const free = stops.filter((_, i) => !locked[i])
  if (free.length <= 1) return stops
  const place = (order: T[]) => {
    let k = 0
    return stops.map((stop, i) => (locked[i] ? stop : order[k++]!))
  }
  let best = stops
  let bestKm = pathKm(stops, start)
  for (const order of permutations(free)) {
    const candidate = place(order)
    const km = pathKm(candidate, start)
    if (km < bestKm - 1e-9) { best = candidate; bestKm = km }
  }
  return best
}

/** Watch-list birds expected across the stops, each counted once; stops not among the places add nothing. */
export const coverage = (stops: PlanPoint[], places: GoPlace[]) => {
  const byId = new Map(places.map(p => [p.locId, p]))
  const miss = new Map<string, number>()
  for (const stop of stops) {
    const place = stop.locId ? byId.get(stop.locId) : undefined
    for (const b of place?.birds ?? []) miss.set(b.speciesCode, (miss.get(b.speciesCode) ?? 1) * (1 - b.chance / 100))
  }
  return Math.round([...miss.values()].reduce((sum, m) => sum + (1 - m), 0) * 10) / 10
}

/** Google Maps directions through the stops; without a start, Maps begins wherever the phone is. */
export const mapsUrl = (stops: PlanPoint[], start: PlanPoint | null = null) => {
  if (!stops.length) return null
  const pt = (p: PlanPoint) => `${p.lat},${p.lng}`
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  if (start) url.searchParams.set('origin', pt(start))
  url.searchParams.set('destination', pt(stops[stops.length - 1]))
  if (stops.length > 1) url.searchParams.set('waypoints', stops.slice(0, -1).map(pt).join('|'))
  url.searchParams.set('travelmode', 'driving')
  return url.toString()
}

/** Google Maps takes at most this many stops in between in a phone's browser (its Maps URLs documentation). */
export const MAX_WAYPOINTS = 3

/**
 * The whole route as Google Maps links a phone can open without dropping stops: one link while
 * there are at most three stops in between, else in parts, each starting where the last one ended.
 * `from` is the stop number the part starts at (null: the meeting point) and `to` the one it ends at.
 */
export const routeLinks = (stops: PlanPoint[], start: PlanPoint | null = null): { url: string; from: number | null; to: number }[] => {
  const points = start ? [start, ...stops] : stops
  if (stops.length === 1 && !start) return [{ url: mapsUrl(stops)!, from: null, to: 1 }]
  const number = (i: number) => (start ? i : i + 1)
  const links: { url: string; from: number | null; to: number }[] = []
  const per = MAX_WAYPOINTS + 1
  for (let i = 0; i < points.length - 1; i += per) {
    const last = Math.min(i + per, points.length - 1)
    links.push({ url: mapsUrl(points.slice(i + 1, last + 1), points[i])!, from: start && i === 0 ? null : number(i), to: number(last) })
  }
  return links
}

/** The list with one item moved from `from` to `to`. */
export const move = <T,>(list: T[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Two stops are the same when they are the same hotspot, or within a few metres of each other. */
export const samePlace = (a: PlanPoint, b: PlanPoint) => (a.locId && b.locId ? a.locId === b.locId : roadKm(a, b) < 0.05)

const isPoint = (p: unknown): p is PlanPoint => Boolean(p) && typeof p === 'object'
  && typeof (p as PlanPoint).name === 'string' && Number.isFinite((p as PlanPoint).lat) && Number.isFinite((p as PlanPoint).lng)

const read = (key: string): unknown => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}
const write = (key: string, value: unknown) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode: the plan lasts the visit */ }
}

const planKey = (region: string) => `bird-alert:route:${region}`
const START_KEY = 'bird-alert:route-start'

const SYNCED_KEY = 'bird-alert:route-synced'
/** Whether this browser's own copy has been handed to the account once; after that the account is the record. */
export const isSynced = () => read(SYNCED_KEY) === true
export const markSynced = () => write(SYNCED_KEY, true)
export const clearLocalRoutes = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('bird-alert:route')) localStorage.removeItem(key)
  } catch { /* nothing kept, nothing to clear */ }
}

export const loadPlan = (region: string): PlanPoint[] | null => {
  const value = read(planKey(region))
  return Array.isArray(value) && value.every(isPoint) ? value.slice(0, MAX_ROUTE_STOPS) : null
}
export const savePlan = (region: string, stops: PlanPoint[] | null) => write(planKey(region), stops)
export const loadStart = (): PlanPoint | null => { const value = read(START_KEY); return isPoint(value) ? value : null }
export const saveStart = (start: PlanPoint | null) => write(START_KEY, start)
