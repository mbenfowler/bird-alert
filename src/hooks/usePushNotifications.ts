import { useCallback, useEffect, useState } from 'react'
import { t } from '../i18n'
import { getPushPublicKey, getPushStatus, sendTestPush, subscribePush, unsubscribePush } from '../apiCalls'

export type PushState =
  | 'checking'      // working out what this browser can do
  | 'unsupported'   // no service worker / Push API here
  | 'denied'        // the user blocked notifications in the browser
  | 'off'           // supported, not subscribed on this device
  | 'on'            // subscribed on this device
  | 'busy'          // a change is in flight

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// ---- this device ----
// A random id for this browser, sent with its subscription so the server keeps one per device, and
// whether alerts were turned on here: an iPhone can drop its subscription by itself (iOS discards
// the Home Screen app's service worker), and this is how the app knows to bring it back.
const DEVICE_KEY = 'bird-alert:device-id'
const HERE_KEY = 'bird-alert:push-here'

export const deviceId = (): string | undefined => {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, '')
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch { return undefined }
}
/** 'on' once alerts were turned on here, 'off' once turned off here; null when this browser never said. */
export const rememberedHere = (): 'on' | 'off' | null => {
  try { const value = localStorage.getItem(HERE_KEY); return value === 'on' || value === 'off' ? value : null } catch { return null }
}
const rememberHere = (value: 'on' | 'off') => { try { localStorage.setItem(HERE_KEY, value) } catch { /* private mode */ } }

/** Tells mounted switches (the Alert Center) that this device's subscription changed outside them. */
export const PUSH_CHANGED = 'bird-alert:push-changed'
const announce = () => window.dispatchEvent(new Event(PUSH_CHANGED))

const fileWithServer = (subscription: PushSubscription) =>
  subscribePush({ ...subscription.toJSON(), userAgent: navigator.userAgent, deviceId: deviceId() })

/** This browser's push subscription, when notifications are allowed and it has one. */
const currentSubscription = async () => {
  if (!supported() || Notification.permission !== 'granted') return null
  // getRegistration, not .ready: .ready waits forever on a page that never registered the worker.
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

/** The worker's registration, waiting a little for main.tsx to register it on a fresh start. */
const readyRegistration = (timeoutMs = 10_000) => Promise.race([
  navigator.serviceWorker.ready,
  new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs))
])

const subscribeHere = async (registration: ServiceWorkerRegistration) => {
  const { publicKey } = await getPushPublicKey()
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
  await fileWithServer(subscription)
  return subscription
}

/**
 * What the load check found: 'on' (subscribed, and filed under this account), 'healed' (the browser
 * had lost its subscription and a new one was made without asking), 'ask' (it was lost and needs a
 * tap to come back: iOS wants a gesture, or it reset the permission), or 'none' (nothing to do here).
 */
export type DeviceCheck = 'on' | 'healed' | 'ask' | 'none'

/**
 * On each sign-in, load and return to the foreground. Notifications belong to the browser, so they
 * follow whoever signs in on it: an existing subscription is filed under the account now using it.
 * And a device that had alerts on but lost its subscription (permission still granted, or reset to
 * "ask" by iOS) gets it back: silently when the browser allows, else by the one-tap prompt.
 */
export const checkThisDevice = async (): Promise<DeviceCheck> => {
  if (!supported() || Notification.permission === 'denied') return 'none'
  const subscription = await currentSubscription()
  if (subscription) {
    const status = await getPushStatus(subscription.endpoint, deviceId())
    if (!status.subscribed) await fileWithServer(subscription)
    if (!rememberedHere()) rememberHere('on')
    return 'on'
  }
  const here = rememberedHere()
  if (here === 'off') return 'none'
  // localStorage may have gone with the subscription, so the server's memory counts too.
  const known = here === 'on' || Boolean((await getPushStatus(undefined, deviceId()).catch(() => null))?.knownDevice)
  if (!known) return 'none'
  if (Notification.permission !== 'granted') return 'ask'
  const registration = await readyRegistration()
  if (!registration) return 'ask'
  try {
    await subscribeHere(registration)
    rememberHere('on')
    announce()
    return 'healed'
  } catch {
    // WebKit may refuse to subscribe without a tap.
    return 'ask'
  }
}

/** Kept for callers that only file the subscription; now also heals (see checkThisDevice). */
export const claimThisDevice = checkThisDevice

/** Before signing out: this browser stops getting the account's alerts. The browser keeps its subscription for the next sign-in. */
export const releaseThisDevice = async () => {
  const subscription = await currentSubscription()
  if (subscription) await unsubscribePush(subscription.endpoint)
}

/**
 * Push subscription for this device, kept in sync with the server. On or off is what this browser
 * has; a failed server check shows as an error under the switch but never turns it off.
 */
export const usePushNotifications = () => {
  const [state, setState] = useState<PushState>('checking')
  const [error, setError] = useState<string | null>(null)
  // A failed server check: said gently, never an error, and never turns the switch off.
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!supported()) return setState('unsupported')
      if (Notification.permission === 'denied') return setState('denied')
      let subscription: PushSubscription | null
      try {
        const registration = await navigator.serviceWorker.ready
        subscription = await registration.pushManager.getSubscription()
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setState('off') }
        return
      }
      if (cancelled) return
      setState(subscription ? 'on' : 'off')
      if (!subscription) return
      // The browser has a subscription; make sure the server knows it belongs to this account.
      try {
        const status = await getPushStatus(subscription.endpoint, deviceId())
        if (!status.subscribed) await fileWithServer(subscription)
        if (!cancelled) setNotice(null)
      } catch {
        // The browser is subscribed whatever the server said; a gentle note, and the switch stays on.
        if (!cancelled) setNotice(t('pushAsk.checkFailed'))
      }
    }
    void check()
    window.addEventListener(PUSH_CHANGED, check)
    return () => { cancelled = true; window.removeEventListener(PUSH_CHANGED, check) }
  }, [])

  const enable = useCallback(async () => {
    setState('busy'); setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return }
      const registration = await navigator.serviceWorker.ready
      // Make sure the newest worker handles pushes, even if this tab has been open since before a deploy.
      await registration.update().catch(() => undefined)
      await subscribeHere(registration)
      rememberHere('on')
      setState('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('off')
    }
  }, [])

  const disable = useCallback(async () => {
    setState('busy'); setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await unsubscribePush(subscription.endpoint)
        await subscription.unsubscribe()
      }
      rememberHere('off')
      setState('off')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('on')
    }
  }, [])

  // Tests go to this device only, so a phone and a laptop can each be checked on their own.
  const sendTest = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready
    await registration.update().catch(() => undefined)
    const subscription = await registration.pushManager.getSubscription()
    return sendTestPush(subscription?.endpoint)
  }, [])

  return { state, error, notice, enable, disable, sendTest }
}
