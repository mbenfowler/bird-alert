import { isIOS, isStandalone } from './install'

/**
 * Asking for push at the moment it means something: right after a bird goes on the watch list, if
 * this device doesn't get alerts yet. Never a nag: once a visit at most, a week's quiet after
 * "Not now", and never again after three of them.
 */

export type LocalPush = 'unsupported' | 'denied' | 'off' | 'on'
export type PushAskVariant = 'enable' | 'install'
export interface PushAskRecord { dismissals: number; last: number }

const KEY = 'bird-alert:push-ask'
export const QUIET_DAYS = 7
export const MAX_DISMISSALS = 3
const DAY = 86_400_000

export const readRecord = (): PushAskRecord => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PushAskRecord> | null
    return { dismissals: Number(parsed?.dismissals) || 0, last: Number(parsed?.last) || 0 }
  } catch { return { dismissals: 0, last: 0 } }
}
const writeRecord = (record: PushAskRecord) => { try { localStorage.setItem(KEY, JSON.stringify(record)) } catch { /* private mode: it may ask again next visit */ } }

/** Whether to ask, given what this device can do and what was said before. */
export const shouldAsk = ({ push, iosTab, record, now }: { push: LocalPush; iosTab: boolean; record: PushAskRecord; now: number }) => {
  if (record.dismissals >= MAX_DISMISSALS) return false
  if (record.last && now - record.last < QUIET_DAYS * DAY) return false
  // An iPhone's Safari tab can't do push at all; the ask there is the way to the Home Screen app.
  if (iosTab) return true
  return push === 'off'
}

/** What this browser can do, without asking the server: supported, allowed, and subscribed here. */
export const localPushState = async (): Promise<LocalPush> => {
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = registration ? await registration.pushManager.getSubscription() : null
  return subscription ? 'on' : 'off'
}

type Listener = (ask: { name: string; variant: PushAskVariant }) => void
let listener: Listener | null = null
let askedThisVisit = false

/** The sheet that shows the ask registers here; there is one, mounted by the app. */
export const onPushAsk = (next: Listener) => {
  listener = next
  return () => { if (listener === next) listener = null }
}

/** Offers alerts for a bird just saved; true when the ask shows (so the "saved" toast can stay quiet). */
export const offerPush = async (name: string): Promise<boolean> => {
  if (!listener || askedThisVisit) return false
  const iosTab = isIOS() && !isStandalone()
  const push = iosTab ? 'off' : await localPushState().catch((): LocalPush => 'unsupported')
  if (!listener || askedThisVisit || !shouldAsk({ push, iosTab, record: readRecord(), now: Date.now() })) return false
  askedThisVisit = true
  listener({ name, variant: iosTab ? 'install' : 'enable' })
  return true
}

/** "Not now": quiet for a week, and after three of them, for good. */
export const dismissPushAsk = (now = Date.now()) => {
  const record = readRecord()
  writeRecord({ dismissals: record.dismissals + 1, last: now })
}

/** "a Painted Bunting", "an American Robin". */
export const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`
