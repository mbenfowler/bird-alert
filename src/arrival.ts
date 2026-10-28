/**
 * What brought a visitor in, noted on their first visit so a signup can say where it came from:
 * the referring site's name (never the full address), a ?utm_source= tag, the share link they
 * landed on, and the kind of page. Kept in this browser for 30 days, first visit wins, and sent
 * only with a signup. Storage can be unavailable (private mode); then nothing is kept.
 */
export interface Arrival { ref?: string; utm?: string; share?: string; landing: 'home' | 'share-sighting' | 'share-route' | 'login' | 'other'; at: number }

const KEY = 'arrivedFrom'
const KEEP_MS = 30 * 24 * 60 * 60 * 1000

/** Pure: the note for a landing, from the page's address and the referrer. */
export const arrivalFor = (href: string, referrer: string, now = Date.now()): Arrival => {
  const url = new URL(href)
  const share = /^\/share\/([sr])\/([A-Za-z0-9]{10})\/?$/.exec(url.pathname)
  const landing: Arrival['landing'] = url.pathname === '/' ? 'home' : share ? (share[1] === 's' ? 'share-sighting' : 'share-route') : url.pathname === '/login' ? 'login' : 'other'
  const out: Arrival = { landing, at: now }
  try {
    const host = referrer ? new URL(referrer).hostname : ''
    if (host && host !== url.hostname) out.ref = host
  } catch { /* an unreadable referrer is no referrer */ }
  const utm = (url.searchParams.get('utm_source') || '').toLowerCase()
  if (/^[a-z0-9_-]{1,40}$/.test(utm)) out.utm = utm
  if (share) out.share = share[2]
  return out
}

/** Notes this visit, unless an earlier one in the last 30 days already is. */
export const noteArrival = () => {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) || 'null') as Arrival | null
    if (kept && Date.now() - kept.at < KEEP_MS) return
    localStorage.setItem(KEY, JSON.stringify(arrivalFor(window.location.href, document.referrer)))
  } catch { /* storage unavailable: nothing kept */ }
}

/** The note, for a signup; null when there is none. */
export const arrival = (): Omit<Arrival, 'at'> | null => {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) || 'null') as Arrival | null
    if (!kept) return null
    const { at, ...rest } = kept
    return Date.now() - at < KEEP_MS ? rest : null
  } catch { return null }
}
