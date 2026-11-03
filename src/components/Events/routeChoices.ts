import type { PlanPoint } from '../../routePlan'

/** Where this viewer starts an event's route. */
export interface RouteStart { name: string; lat: number; lng: number; /** From the browser's location: shown as "your location". */ mine?: boolean }
/** This viewer's route for an event: their start, and their own stops (null follows the suggestion). */
export interface RouteChoices { start: RouteStart | null; stops: PlanPoint[] | null }

export const NO_CHOICES: RouteChoices = { start: null, stops: null }

const key = (eventId: number | string) => `bird-alert:event-route:${eventId}`

/** Two decimals is about a kilometre: plenty for a start, and no more precise than it needs to be. */
export const round2 = (n: number) => Math.round(n * 100) / 100

const isPoint = (p: unknown): p is PlanPoint => Boolean(p) && typeof p === 'object'
  && typeof (p as PlanPoint).name === 'string' && Number.isFinite((p as PlanPoint).lat) && Number.isFinite((p as PlanPoint).lng)

/** This viewer's choices for an event, from this browser; none when storage is unavailable or holds something else. */
export const readChoices = (eventId: number | string): RouteChoices => {
  try {
    const raw = JSON.parse(localStorage.getItem(key(eventId)) ?? 'null') as { start?: unknown; stops?: unknown } | null
    if (!raw || typeof raw !== 'object') return NO_CHOICES
    const s = raw.start as RouteStart | null | undefined
    const start = isPoint(s) ? { name: s.name, lat: round2(s.lat), lng: round2(s.lng), ...((s as RouteStart).mine ? { mine: true } : {}) } : null
    const stops = Array.isArray(raw.stops)
      ? raw.stops.filter(isPoint).map(p => ({ locId: typeof p.locId === 'string' ? p.locId : null, name: p.name, lat: p.lat, lng: p.lng }))
      : null
    return { start, stops }
  } catch {
    return NO_CHOICES
  }
}

/** Kept for next time; nothing is lost but the memory when storage is unavailable. */
export const saveChoices = (eventId: number | string, choices: RouteChoices) => {
  try {
    if (!choices.start && choices.stops === null) localStorage.removeItem(key(eventId))
    else localStorage.setItem(key(eventId), JSON.stringify(choices))
  } catch { /* this visit only */ }
}
