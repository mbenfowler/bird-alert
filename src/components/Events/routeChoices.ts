/** Where this viewer starts an event's route, and the places they put in or took out. */
export interface RouteStart { name: string; lat: number; lng: number; /** From the browser's location: shown as "your location". */ mine?: boolean }
export interface RouteChoices { start: RouteStart | null; add: string[]; drop: string[] }

export const NO_CHOICES: RouteChoices = { start: null, add: [], drop: [] }

const key = (eventId: number | string) => `bird-alert:event-route:${eventId}`

/** Two decimals is about a kilometre: plenty for a start, and no more precise than it needs to be. */
export const round2 = (n: number) => Math.round(n * 100) / 100

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [])

/** This viewer's choices for an event, from this browser; none when storage is unavailable or holds something else. */
export const readChoices = (eventId: number | string): RouteChoices => {
  try {
    const raw = JSON.parse(localStorage.getItem(key(eventId)) ?? 'null') as Partial<RouteChoices> | null
    if (!raw || typeof raw !== 'object') return NO_CHOICES
    const s = raw.start
    const start = s && typeof s.name === 'string' && Number.isFinite(s.lat) && Number.isFinite(s.lng)
      ? { name: s.name, lat: round2(s.lat), lng: round2(s.lng), ...(s.mine ? { mine: true } : {}) }
      : null
    return { start, add: ids(raw.add), drop: ids(raw.drop) }
  } catch {
    return NO_CHOICES
  }
}

/** Kept for next time; nothing is lost but the memory when storage is unavailable. */
export const saveChoices = (eventId: number | string, choices: RouteChoices) => {
  try {
    if (!choices.start && !choices.add.length && !choices.drop.length) localStorage.removeItem(key(eventId))
    else localStorage.setItem(key(eventId), JSON.stringify(choices))
  } catch { /* this visit only */ }
}
