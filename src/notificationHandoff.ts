/**
 * Hand-off from the service worker to the page for push notifications. The worker records what it
 * showed and where a tap should land in the Cache API, and also broadcasts them; the page claims
 * them when it starts, comes to the foreground, hears the broadcast, or on a short poll while
 * visible. iOS Home Screen apps neither navigate an existing window nor reliably deliver the
 * worker's message, so no single path is trusted.
 */
export const HANDOFF_CACHE = 'bird-alert-pending-open'
export const PENDING_OPEN_KEY = '/pending-open'
export const LATEST_PUSH_KEY = '/latest-push'
export const CHANNEL = 'bird-alert-notifications'
const OPEN_MAX_AGE_MS = 10 * 60_000
const PUSH_MAX_AGE_MS = 60_000

/** A same-origin path for a URL, or null when it points elsewhere. */
export const samePath = (url: unknown): string | null => {
  if (typeof url !== 'string') return null
  try {
    const target = new URL(url, window.location.origin)
    return target.origin === window.location.origin ? target.pathname + target.search : null
  } catch {
    return null
  }
}

const take = async (key: string): Promise<Record<string, unknown> | null> => {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(HANDOFF_CACHE)
    const response = await cache.match(key)
    if (!response) return null
    await cache.delete(key)
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Where a tapped notification should land, removed so it is followed once. Null if none or stale. */
export const takePendingOpen = async (): Promise<string | null> => {
  const record = await take(PENDING_OPEN_KEY)
  if (!record || typeof record.at !== 'number' || Date.now() - record.at > OPEN_MAX_AGE_MS) return null
  return samePath(record.url)
}

export interface LatestPush { title: string; path: string }

/** The notification shown moments ago, removed so it is announced in-app once. Null if none or stale. */
export const takeLatestPush = async (): Promise<LatestPush | null> => {
  const record = await take(LATEST_PUSH_KEY)
  if (!record || typeof record.at !== 'number' || Date.now() - record.at > PUSH_MAX_AGE_MS) return null
  const path = samePath(record.url)
  return path && typeof record.title === 'string' ? { title: record.title, path } : null
}

export type PendingTrigger = 'poll' | 'foreground'

/**
 * What the app should do with the server's latest push. On a poll: follow a tap, offer a toast, or
 * nothing. When the app was just launched or brought to the foreground: go straight to any recent
 * push nobody has opened yet, because on iPhone that is all a banner tap does to an app in the
 * background, and someone opening the app minutes after an alert most likely came for it.
 */
export const decidePending = (push: { url: string; sentAt: string; tappedAt: string | null; offeredAt: string | null; openedAt: string | null } | null, now = Date.now(), trigger: PendingTrigger = 'poll'): 'open' | 'offer' | null => {
  if (!push) return null
  const age = now - Date.parse(push.sentAt)
  if (!Number.isFinite(age) || age > OPEN_MAX_AGE_MS) return null
  if (push.openedAt) return null
  if (push.tappedAt || trigger === 'foreground') return 'open'
  if (!push.offeredAt && age <= PUSH_MAX_AGE_MS * 2) return 'offer'
  return null
}

/** Poll the server quickly while a recent push may still be tapped, slowly otherwise. */
export const pollInterval = (push: { sentAt: string; openedAt: string | null } | null, now = Date.now()) =>
  push && !push.openedAt && now - Date.parse(push.sentAt) <= OPEN_MAX_AGE_MS ? 2_000 : 10_000
