import { useCallback, useEffect, useState } from 'react'
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

/** Push subscription for this device, kept in sync with the server. */
export const usePushNotifications = () => {
  const [state, setState] = useState<PushState>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!supported()) return setState('unsupported')
      if (Notification.permission === 'denied') return setState('denied')
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) return cancelled || setState('off')
        // The browser has a subscription; make sure the server knows it belongs to this account.
        const status = await getPushStatus(subscription.endpoint)
        if (!status.subscribed) await subscribePush({ ...subscription.toJSON(), userAgent: navigator.userAgent })
        if (!cancelled) setState('on')
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setState('off') }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const enable = useCallback(async () => {
    setState('busy'); setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return }
      const [{ publicKey }, registration] = await Promise.all([getPushPublicKey(), navigator.serviceWorker.ready])
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })
      await subscribePush({ ...subscription.toJSON(), userAgent: navigator.userAgent })
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
      setState('off')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('on')
    }
  }, [])

  // Tests go to this device only, so a phone and a laptop can each be checked on their own.
  const sendTest = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return sendTestPush(subscription?.endpoint)
  }, [])

  return { state, error, enable, disable, sendTest }
}
