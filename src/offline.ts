import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { ApiError, NetworkError } from './apiCalls'

/**
 * Telling "no signal" apart from "not there". A request that never got an answer (offline, one bar
 * that drops it, a timeout) is a network error: the page says so and shows what it saved. Only an
 * answer from the server (a 404 or 403) means the thing is really gone or not theirs.
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof NetworkError) return true
  if (error instanceof ApiError) return false
  // fetch() itself only rejects with a TypeError (Chrome "Failed to fetch", Safari "Load failed"),
  // and a timeout or a cut-off body rejects with these.
  return error instanceof Error && (error.name === 'TypeError' || error.name === 'AbortError' || error.name === 'TimeoutError')
}

/** The server answered that this isn't there, or isn't this person's. */
export const isGone = (error: unknown): boolean => error instanceof ApiError && (error.status === 404 || error.status === 403 || error.status === 410)

/**
 * Worth trying again by itself: no answer at all, or the server or the network between was briefly
 * unavailable. Anything else (a 4xx) would fail the same way again.
 */
export const isTransient = (error: unknown): boolean =>
  isNetworkError(error) || (error instanceof ApiError && [408, 429, 500, 502, 503, 504].includes(error.status))

/** Whether the browser says it has a network (TanStack's online manager, which pauses queries and writes while it's off). */
export const useOnline = () => useSyncExternalStore(
  (onChange) => onlineManager.subscribe(onChange),
  () => onlineManager.isOnline(),
  () => true
)
