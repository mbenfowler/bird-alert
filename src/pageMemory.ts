import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * What a page looked like when someone left it (a tab picked, a search typed, how far a row was
 * scrolled), kept per history entry in this tab's sessionStorage. Back to that entry (the back
 * button, the browser's Back, a swipe) finds it as it was; a fresh visit to the same address is a
 * new entry and starts clean, and so does a reload. The router's own key names the entry: "default"
 * for the first one.
 */
const PREFIX = 'bird-alert:page:'
const keyOf = (entry: string, name: string) => `${PREFIX}${entry}:${name}`

/** Forgets every page. Each load of the app starts clean (a reload, a relaunch), so only Back finds a page as it was left. */
export const forgetPages = () => {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const name = sessionStorage.key(i)
      if (name?.startsWith(PREFIX)) sessionStorage.removeItem(name)
    }
  } catch { /* nothing kept */ }
}

export const recall = <T>(entry: string, name: string): T | undefined => {
  try {
    const raw = sessionStorage.getItem(keyOf(entry, name))
    return raw === null ? undefined : JSON.parse(raw) as T
  } catch { return undefined }
}

export const remember = (entry: string, name: string, value: unknown) => {
  try { sessionStorage.setItem(keyOf(entry, name), JSON.stringify(value)) } catch { /* private mode: it just isn't kept */ }
}

/** useState that comes back as it was when this history entry is returned to. */
export const usePageMemory = <T>(name: string, initial: T, valid?: (value: unknown) => value is T) => {
  const { key } = useLocation()
  const [value, setValue] = useState<T>(() => {
    const kept = recall<unknown>(key, name)
    return kept !== undefined && (!valid || valid(kept)) ? kept as T : initial
  })
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
      remember(key, name, resolved)
      return resolved
    })
  }, [key, name])
  return [value, set] as const
}

/**
 * Whether there is an earlier page of this app to go back to in this tab. The router numbers its
 * history entries (idx); the first page opened in a tab, or by an email or notification link, is 0.
 */
export const canGoBack = (state: unknown = typeof window === 'undefined' ? null : window.history.state): boolean => {
  const idx = (state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' && idx > 0
}

/** The router's key for the entry the browser is on now ("default" for the first one). */
const currentEntry = () => (window.history.state as { key?: string } | null)?.key ?? 'default'

/**
 * How far down each page was scrolled, put back when its history entry is returned to. Browsers try
 * this themselves, but often before the page has its height again, and land short. Here the place is
 * tried each frame for a second, until it holds or the person scrolls on their own.
 */
export const useScrollMemory = () => {
  const { key } = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => {
    // Only while this entry is the one showing: leaving it can clamp the scroll as the next page draws.
    const save = () => { if (currentEntry() === key) remember(key, 'scrollY', window.scrollY) }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key])
  useEffect(() => {
    if (navigationType !== 'POP') return
    const y = recall<number>(key, 'scrollY')
    if (typeof y !== 'number' || y <= 0) return
    let frame = 0
    let tries = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(type, stop)
    }
    const step = () => {
      window.scrollTo(0, y)
      if (Math.abs(window.scrollY - y) < 2 || ++tries > 60) { stop(); return }
      frame = requestAnimationFrame(step)
    }
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(type, stop, { passive: true })
    frame = requestAnimationFrame(step)
    return stop
  }, [key, navigationType])
}
