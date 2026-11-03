import type { PlanPoint } from '../../routePlan'
import type { Drive, EventRoute, EventScouting } from '../../types'
import type { RouteStart } from './routeChoices'

type Report = EventScouting['reported'][number]
type Stop = EventRoute['stops'][number]

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
export const customRoute = ({ suggested, reported, stops, start, drive, driveFailed }: {
  suggested: EventRoute | undefined
  reported: Report[]
  stops: PlanPoint[]
  start: RouteStart | null
  drive: Drive | null | undefined
  driveFailed: boolean
}): EventRoute => {
  const speciesAt = speciesByPlace(suggested, reported)
  const name = nameOf(suggested, reported)
  const known = new Map([...(suggested?.stops ?? []), ...(suggested?.extras ?? [])].map(p => [p.locId, p]))
  const covered = new Set<string>()
  const legs = drive?.legs ?? []
  const routeStops: Stop[] = stops.map((stop, i) => {
    const fresh = speciesAt(stop.locId).filter(code => !covered.has(code))
    fresh.forEach(code => covered.add(code))
    const leg = legs[start ? i : i - 1] ?? null
    const place = stop.locId ? known.get(stop.locId) : undefined
    return {
      n: i + 1, locId: stop.locId ?? '', locName: stop.name, lat: stop.lat, lng: stop.lng,
      new_birds: fresh.map(code => ({ code, comName: name(code) })),
      leg_min: leg ? leg.minutes : null, leg_mi: leg ? leg.miles : null,
      private: place?.private, merged: place?.merged
    }
  })
  const straight = [...(start ? [start] : []), ...stops].map(p => [p.lat, p.lng] as [number, number])
  return {
    from: start ? { lat: start.lat, lng: start.lng } : null,
    stops: routeStops,
    extras: [],
    total_min: drive ? drive.minutes : null,
    total_mi: drive ? drive.miles : null,
    covered: covered.size,
    reported: suggested?.reported ?? new Set(reported.map(r => r.code)).size,
    skipped: 0,
    geometry: drive?.geometry?.length ? drive.geometry : straight,
    routed: !driveFailed
  }
}
