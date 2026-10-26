import type { MapFocus } from './components/SightingsMap/SightingsMap'
import type { NearbyPublic } from './types'

/** The map's focus for a private place: the place, its public lands, and the road to each. */
export const focusFor = (origin: { lat: number; lng: number; label: string }, nearby: NearbyPublic | undefined): MapFocus => ({
  origin,
  targets: [
    ...(nearby?.hotspots ?? []).map(h => ({ id: h.locId, lat: h.lat, lng: h.lng, label: h.name.replace(/^Lake Lanier--/, ''), detail: h.drive ? `${h.drive.minutes} min drive` : `${h.miles} mi`, kind: 'hotspot' as const, path: h.drive?.geometry ?? null, minutes: h.drive?.minutes ?? null })),
    ...(nearby?.parks ?? []).map(p => ({ id: `${p.name}-${p.lat}`, lat: p.lat, lng: p.lng, label: p.name, detail: p.drive ? `${p.drive.minutes} min drive` : `${p.miles} mi`, kind: 'park' as const, path: p.drive?.geometry ?? null, minutes: p.drive?.minutes ?? null }))
  ]
})

/** Closes a focus when the pointer goes down outside the list and the map. */
export const closeOnOutside = (onClose: () => void) => {
  const handler = (event: PointerEvent) => {
    const el = event.target as Element | null
    if (el && (el.closest('.nearby') || el.closest('.sightings-map') || el.closest('.leaflet-container'))) return
    onClose()
  }
  document.addEventListener('pointerdown', handler)
  return () => document.removeEventListener('pointerdown', handler)
}
