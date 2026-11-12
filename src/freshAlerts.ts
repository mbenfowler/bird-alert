import { useEffect, useMemo, useState } from 'react'

/**
 * Alerts that just came in, so the alert bar can make the bird's card stand out: it arrives with
 * its own entrance, then pulses red for an hour with "Reported 12 min ago". Kept on the device
 * (localStorage) for that hour, so an alert heard while away still shows when the app is opened.
 * An alert names its sightings in its link: /sighting/<code>/<subId>, or a batch's
 * /sightings?s=<code>:<subId>,…
 */
const KEY = 'bird-alert:fresh-alerts'
export const FRESH_MS = 60 * 60_000
/** The entrance plays only for a card that shows up this soon after its alert. */
const ARRIVAL_MS = 2 * 60_000
export const FRESH_EVENT = 'bird-alert:fresh-alert'

export interface FreshAlert { code: string; subId: string; at: number }

const read = (now = Date.now()): FreshAlert[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(list)) return []
    return list.filter((a): a is FreshAlert => typeof a?.code === 'string' && typeof a?.subId === 'string' && typeof a?.at === 'number' && now - a.at < FRESH_MS)
  } catch { return [] }
}

/** The sightings an alert's link points at. */
export const sightingsIn = (path: string | null): Array<{ code: string; subId: string }> => {
  if (!path) return []
  const url = new URL(path, 'https://x.invalid')
  const one = url.pathname.match(/^\/sighting\/([a-z0-9]+)\/(S\d+)$/i)
  if (one) return [{ code: one[1]!, subId: one[2]! }]
  if (url.pathname !== '/sightings') return []
  return (url.searchParams.get('s') ?? '').split(',').map(pair => pair.split(':')).filter(([code, subId]) => code && /^S\d+$/i.test(subId ?? '')).map(([code, subId]) => ({ code: code!, subId: subId! }))
}

/** An alert arrived: its sightings are fresh from now (an alert heard twice keeps its first time). */
export const noteFreshAlert = (path: string | null, now = Date.now()) => {
  const found = sightingsIn(path)
  if (!found.length) return
  const list = read(now)
  for (const s of found) if (!list.some(a => a.code === s.code && a.subId === s.subId)) list.push({ ...s, at: now })
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode: this page only misses the pulse */ }
  window.dispatchEvent(new Event(FRESH_EVENT))
}

export const freshKey = (code: string, subId: string) => `${code}|${subId}`

/** Fresh alerts by freshKey, with minutes since each and whether the card should still make its entrance. */
export const freshAlerts = (now = Date.now()) => {
  const fresh = new Map<string, { minutes: number; arriving: boolean }>()
  for (const a of read(now)) fresh.set(freshKey(a.code, a.subId), { minutes: Math.max(0, Math.floor((now - a.at) / 60_000)), arriving: now - a.at < ARRIVAL_MS })
  return fresh
}

/** freshAlerts, rechecked every half minute and whenever an alert arrives. */
export const useFreshAlerts = () => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 30_000)
    window.addEventListener(FRESH_EVENT, tick)
    window.addEventListener('storage', tick)
    return () => { window.clearInterval(timer); window.removeEventListener(FRESH_EVENT, tick); window.removeEventListener('storage', tick) }
  }, [])
  return useMemo(() => freshAlerts(now), [now])
}
