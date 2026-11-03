import type { PlanPoint } from '../../routePlan'

/**
 * Before routes were kept on the event, a viewer's own route lived in this browser. Read once, to
 * offer it to the group, then cleared.
 */
export interface LegacyRoute { start: { name: string; lat: number; lng: number } | null; stops: PlanPoint[] }

const key = (eventId: number | string) => `bird-alert:event-route:${eventId}`

const isPoint = (p: unknown): p is PlanPoint => Boolean(p) && typeof p === 'object'
  && typeof (p as PlanPoint).name === 'string' && Number.isFinite((p as PlanPoint).lat) && Number.isFinite((p as PlanPoint).lng)

/** The old route of this browser's own, with stops; null when there is none or storage is unavailable. */
export const readLegacyRoute = (eventId: number | string): LegacyRoute | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(key(eventId)) ?? 'null') as { start?: unknown; stops?: unknown } | null
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.stops)) return null
    const stops = raw.stops.filter(isPoint).map(p => ({ locId: typeof p.locId === 'string' ? p.locId : null, name: p.name, lat: p.lat, lng: p.lng }))
    if (!stops.length) return null
    const s = raw.start
    return { start: isPoint(s) ? { name: s.name, lat: s.lat, lng: s.lng } : null, stops }
  } catch {
    return null
  }
}

export const clearLegacyRoute = (eventId: number | string) => {
  try { localStorage.removeItem(key(eventId)) } catch { /* nothing to clear */ }
}
