import { useLocation } from 'react-router'

/**
 * Where someone was going when the app asked them to log in: a shared event, an invite, a bird, a
 * settings tab. It rides along as /login?next=<path>, and in this tab's sessionStorage too, so a step
 * that drops the query (a new account's setup, a passkey prompt) still ends where they meant to go.
 */
const KEY = 'bird-alert:next'
const ORIGIN = 'https://app.invalid'
// Never back to a sign-in page: that would loop.
const NEVER = /^\/(login|signup)(\/|$)/i

/** A same-app path ("/events/2?x#y"), or null: no scheme, no "//" or "/\", nothing that leaves the app. */
export const safeNext = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  // Control characters and backslashes can be read as a host by some browsers; refuse them outright.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null
  let url: URL
  try { url = new URL(raw, ORIGIN) } catch { return null }
  if (url.origin !== ORIGIN) return null
  if (NEVER.test(url.pathname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}

export const rememberNext = (path: string) => {
  const safe = safeNext(path)
  if (!safe) return
  try { sessionStorage.setItem(KEY, safe) } catch { /* the query still carries it */ }
}

export const storedNext = (): string | null => {
  try { return safeNext(sessionStorage.getItem(KEY)) } catch { return null }
}

export const forgetNext = () => {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing kept */ }
}

/** The login page that comes back to `path` afterwards. Pure, for links; the login page remembers it. */
export const loginHref = (path: string | null | undefined): string => {
  const safe = safeNext(path)
  return !safe || safe === '/' ? '/login' : `/login?next=${encodeURIComponent(safe)}`
}

/** The same, remembered in this tab at once (for a redirect, which may lose the query on the way). */
export const loginTo = (path: string | null | undefined): string => {
  rememberNext(path ?? '')
  return loginHref(path)
}

/** Where to go after signing in: ?next= (home when it isn't safe), else what this tab remembered, else home. */
export const nextAfterLogin = (search: string): string => {
  const next = new URLSearchParams(search).get('next')
  if (next !== null) return safeNext(next) ?? '/'
  return storedNext() ?? '/'
}

/** A login link from the page this is on, that comes back here afterwards. */
export const useLoginHere = (): string => {
  const { pathname, search, hash } = useLocation()
  return loginHref(`${pathname}${search}${hash}`)
}
