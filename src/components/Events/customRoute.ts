import type { PlanPoint } from '../../routePlan'
import type { Drive, EventRoute, EventRoutePlan, EventScouting, RoutePlanStop } from '../../types'

type Report = EventScouting['reported'][number]
type Start = { name: string; lat: number; lng: number }
type Stop = EventRoute['stops'][number]
/** A stop with its time there: the group's minutes (null: the suggestion's) and the suggestion's. */
export type StayStop = PlanPoint & Pick<RoutePlanStop, 'stay_min' | 'suggested_stay_min'>

/** The minutes a stop counts for: the group's, else the suggestion's, else none yet. */
export const stayOf = (stop: Pick<RoutePlanStop, 'stay_min' | 'suggested_stay_min'>) => stop.stay_min ?? stop.suggested_stay_min ?? 0
export const stayTotal = (stops: Pick<RoutePlanStop, 'stay_min' | 'suggested_stay_min'>[]) => stops.reduce((sum, s) => sum + stayOf(s), 0)

/** The minutes at a route's stops: the suggestion's own total when it gives one, else each stop's. */
export const routeStay = (route: EventRoute) => (typeof route.stay_min_total === 'number' && route.stops.every(s => s.stay_min === undefined)
  ? route.stay_min_total
  : stayTotal(route.stops))

/**
 * Each stop's suggested stay: the saved route's (the server works it out for every stop it has),
 * else the suggested route's for the same place. A place just added has none until it is saved.
 */
export const withStays = (stops: (PlanPoint & { stay_min?: number | null })[], saved: RoutePlanStop[] | null | undefined, suggested: EventRoute | undefined): StayStop[] =>
  stops.map(stop => {
    const same = (p: { locId: string | null; lat: number; lng: number }) => (stop.locId ? p.locId === stop.locId : !p.locId && p.lat === stop.lat && p.lng === stop.lng)
    const fromSaved = saved?.find(same)?.suggested_stay_min
    const fromSuggestion = stop.locId ? suggested?.stops.find(s => s.locId === stop.locId)?.suggested_stay_min : undefined
    return { ...stop, stay_min: stop.stay_min ?? null, suggested_stay_min: fromSaved ?? fromSuggestion ?? null }
  })

/**
 * What each place can add: the targets reported there this week. The suggestion's own lists come
 * first (personal spots already folded in), then the scouting reports; a typed place adds nothing.
 */
export const speciesByPlace = (suggested: EventRoute | undefined, reported: Report[]) => {
  const at = new Map<string, Set<string>>()
  for (const r of reported) {
    if (!r.locId) continue
    if (!at.has(r.locId)) at.set(r.locId, new Set())
    at.get(r.locId)!.add(r.code)
  }
  for (const p of [...(suggested?.stops ?? []), ...(suggested?.extras ?? [])]) {
    if (Array.isArray(p.species)) at.set(p.locId, new Set(p.species))
  }
  return (locId: string | null): string[] => (locId ? [...(at.get(locId) ?? [])] : [])
}

/** A target's name: the suggestion's names, else its reports, else the code. */
export const nameOf = (suggested: EventRoute | undefined, reported: Report[]) => {
  const names = new Map<string, string>()
  for (const r of reported) if (r.comName && !names.has(r.code)) names.set(r.code, r.comName)
  for (const p of [...(suggested?.stops ?? []), ...(suggested?.extras ?? [])]) for (const b of p.new_birds) if (b.comName) names.set(b.code, b.comName)
  for (const [code, name] of Object.entries(suggested?.names ?? {})) names.set(code, name)
  return (code: string) => names.get(code) ?? code
}

/**
 * The viewer's own route in the suggestion's shape, so it reads the same: each stop's new birds in
 * visit order, the drive between them (from /ebird/drive, when it has answered), and how many of the
 * week's reported targets it covers.
 */
export const customRoute = ({ suggested, reported, stops, start, drive, driveFailed, server = null }: {
  suggested: EventRoute | undefined
  reported: Report[]
  stops: StayStop[] | PlanPoint[]
  start: Start | null
  drive: Drive | null | undefined
  driveFailed: boolean
  /** The saved record's own drive times, while /ebird/drive hasn't answered for the same stops. */
  server?: Pick<EventRoutePlan, 'legs' | 'totals' | 'routed'> | null
}): EventRoute => {
  const speciesAt = speciesByPlace(suggested, reported)
  const name = nameOf(suggested, reported)
  const known = new Map([...(suggested?.stops ?? []), ...(suggested?.extras ?? [])].map(p => [p.locId, p]))
  const covered = new Set<string>()
  const legs = drive?.legs ?? []
  const serverLegs = !drive && server?.legs?.length === stops.length ? server.legs : null
  const routeStops: Stop[] = (stops as StayStop[]).map((stop, i) => {
    const fresh = speciesAt(stop.locId).filter(code => !covered.has(code))
    fresh.forEach(code => covered.add(code))
    const fromServer = serverLegs?.[i]
    const leg = serverLegs ? (fromServer ? { minutes: fromServer.min, miles: fromServer.mi } : null) : legs[start ? i : i - 1] ?? null
    const place = stop.locId ? known.get(stop.locId) : undefined
    return {
      n: i + 1, locId: stop.locId ?? '', locName: stop.name, lat: stop.lat, lng: stop.lng,
      new_birds: fresh.map(code => ({ code, comName: name(code) })),
      leg_min: leg ? leg.minutes : null, leg_mi: leg ? leg.miles : null,
      private: place?.private, merged: place?.merged,
      stay_min: stop.stay_min ?? null, suggested_stay_min: stop.suggested_stay_min ?? null
    }
  })
  const serverMiles = serverLegs && server?.totals?.drive_min != null ? serverLegs.reduce((sum, l) => sum + (l ? l.mi : 0), 0) : null
  const straight = [...(start ? [start] : []), ...stops].map(p => [p.lat, p.lng] as [number, number])
  return {
    from: start ? { lat: start.lat, lng: start.lng } : null,
    stops: routeStops,
    extras: [],
    total_min: drive ? drive.minutes : serverMiles !== null ? server!.totals!.drive_min : null,
    total_mi: drive ? drive.miles : serverMiles !== null ? Math.round(serverMiles * 10) / 10 : null,
    covered: covered.size,
    reported: suggested?.reported ?? new Set(reported.map(r => r.code)).size,
    skipped: 0,
    geometry: drive?.geometry?.length ? drive.geometry : straight,
    routed: drive ? true : serverLegs ? server!.routed !== false : server?.routed === false ? false : !driveFailed
  }
}
