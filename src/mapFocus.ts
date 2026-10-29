import type { MapFocus } from './components/SightingsMap/SightingsMap'
import type { NearbyPublic } from './types'
import { shortDistance, type DistanceUnit } from './distance'

/** The map's focus for a private place: the place, its public lands, and the road to each. */
export const focusFor = (origin: { lat: number; lng: number; label: string }, nearby: NearbyPublic | undefined, unit: DistanceUnit = 'mi'): MapFocus => {
  const hotspots = nearby?.hotspots ?? []
  const parks = nearby?.parks ?? []
  // Numbered in list order: hotspots first, then parks, the same order NearbyPublic renders.
  return {
    origin,
    targets: [
      ...hotspots.map((h, i) => ({ id: h.locId, n: i + 1, lat: h.lat, lng: h.lng, label: h.name.replace(/^Lake Lanier--/, ''), detail: h.drive ? `${h.drive.minutes} min drive · ${shortDistance(h.drive.miles, unit)}` : `${shortDistance(h.miles, unit)} as the crow flies`, kind: 'hotspot' as const, path: h.drive?.geometry ?? null, minutes: h.drive?.minutes ?? null })),
      ...parks.map((p, i) => ({ id: `${p.name}-${p.lat}`, n: hotspots.length + i + 1, lat: p.lat, lng: p.lng, label: p.name, detail: p.drive ? `${p.drive.minutes} min drive · ${shortDistance(p.drive.miles, unit)}` : `${shortDistance(p.miles, unit)} as the crow flies`, kind: 'park' as const, path: p.drive?.geometry ?? null, minutes: p.drive?.minutes ?? null }))
    ]
  }
}
