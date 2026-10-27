import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, startRegistration, WebAuthnAbortService } from '@simplewebauthn/browser'
import { passkeyLogin, passkeyLoginOptions, passkeyRegister, passkeyRegisterOptions } from './apiCalls'
import type { User } from './types'

/** What the device calls its own lock, for the prompts: "Face ID" reads better than "a passkey". */
export const unlockName = () => {
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Windows/.test(ua)) return 'Windows Hello'
  if (/Android/.test(ua)) return 'your fingerprint'
  return 'your device’s lock'
}

export const passkeysSupported = () => browserSupportsWebAuthn()

/** Sign in with a passkey: the device asks, no email needed. `autofill` waits quietly in the email field's suggestions. */
export const signInWithPasskey = async (autofill = false): Promise<User | null> => {
  if (autofill && !(await browserSupportsWebAuthnAutofill())) return null
  const { options, token } = await passkeyLoginOptions()
  const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'], useBrowserAutofill: autofill })
  return passkeyLogin(response, token)
}

/** Adds a passkey for the logged-in account on this device. */
export const addPasskey = async () => {
  const { options, token } = await passkeyRegisterOptions()
  const response = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] })
  return passkeyRegister(response, token)
}

/** Stops a waiting autofill request, e.g. when leaving the login page. */
export const cancelPasskeyAutofill = () => WebAuthnAbortService.cancelCeremony()

/** Cancelling the device's prompt is a choice, not an error worth showing. */
export const wasCancelled = (error: unknown) => {
  const name = (error as { name?: string })?.name
  return name === 'NotAllowedError' || name === 'AbortError'
}
