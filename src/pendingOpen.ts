/**
 * Hand-off from the service worker to the page for notification taps. The worker records where a
 * tap should land before it focuses or opens the app; the page claims it when it starts or comes
 * back to the foreground. This is what makes taps work on iOS Home Screen apps, which neither
 * navigate an existing window nor reliably deliver a message to a suspended one.
 */
export const PENDING_OPEN_CACHE = 'bird-alert-pending-open'
export const PENDING_OPEN_KEY = '/pending-open'
const MAX_AGE_MS = 5 * 60_000

/** The recorded target as a same-origin path, removing it so it is followed once. Null if none. */
export const takePendingOpen = async (): Promise<string | null> => {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(PENDING_OPEN_CACHE)
    const response = await cache.match(PENDING_OPEN_KEY)
    if (!response) return null
    await cache.delete(PENDING_OPEN_KEY)
    const { url, at } = (await response.json()) as { url?: unknown; at?: unknown }
    if (typeof url !== 'string' || typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) return null
    const target = new URL(url, window.location.origin)
    return target.origin === window.location.origin ? target.pathname + target.search : null
  } catch {
    return null
  }
}
