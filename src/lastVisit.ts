/**
 * When this browser last had the app open, so sightings reported since can be marked new. Read once
 * per page load (the marks stay put while you look), and written as the page is hidden or left, so
 * the next visit compares against the end of this one. Storage can be blocked; then nothing is new.
 */
const KEY = 'lastVisit'

const read = (): number | null => {
  try {
    const value = Number(localStorage.getItem(KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

let previous: number | null | undefined

/** The end of the previous visit (ms), or null on a first visit. */
export const previousVisit = (): number | null => {
  if (previous === undefined) previous = read()
  return previous
}

export const recordVisit = (at = Date.now()) => {
  try { localStorage.setItem(KEY, String(at)) } catch { /* storage unavailable: nothing is marked new */ }
}

/** eBird's obsDt ('YYYY-MM-DD HH:mm', local time) as ms, or null. */
export const obsTime = (obsDt: string | null | undefined): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(String(obsDt ?? ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)).getTime()
}

/** Whether a sighting was reported after the previous visit ended. */
export const isNewSince = (obsDt: string | null | undefined, since: number | null) => {
  const at = obsTime(obsDt)
  return since !== null && at !== null && at > since
}

let listening = false
/** Notes the end of each visit: when the page is hidden (app switched, tab closed) or left. */
export const watchVisits = () => {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') recordVisit() })
  window.addEventListener('pagehide', () => recordVisit())
}

/** For tests: forget the value read at load. */
export const resetPreviousVisit = () => { previous = undefined }
