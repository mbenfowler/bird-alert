import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getPushStatus: vi.fn(),
  subscribePush: vi.fn(),
  getPushPublicKey: vi.fn(),
  unsubscribePush: vi.fn(),
  sendTestPush: vi.fn()
}))
vi.mock('../apiCalls', () => api)

import { checkThisDevice, lastAskReason, usePushNotifications, PUSH_CHANGED } from './usePushNotifications'

const makeSub = (endpoint = 'https://web.push.apple.com/new') => ({ endpoint, toJSON: () => ({ endpoint, keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: vi.fn(async () => true) })

/** The browser's push, faked: a permission, a registration whose subscription is `sub`, and a subscribe that may refuse. */
const fakeBrowser = ({ permission = 'granted', sub = null as ReturnType<typeof makeSub> | null, refuse = false } = {}) => {
  const state = { sub }
  const pushManager = {
    getSubscription: vi.fn(async () => state.sub),
    subscribe: vi.fn(async () => {
      if (refuse) throw new DOMException('Push notification prompting can only be done from a user gesture.', 'NotAllowedError')
      return (state.sub = makeSub())
    })
  }
  const registration = { pushManager, update: vi.fn(async () => undefined) }
  vi.stubGlobal('Notification', Object.assign(function Notification () {}, { permission, requestPermission: vi.fn(async () => 'granted') }))
  vi.stubGlobal('PushManager', function PushManager () {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: async () => registration }
  })
  return { state, pushManager }
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    localStorage.clear()
    api.getPushPublicKey.mockResolvedValue({ publicKey: 'BFakeKeyForTests' })
    api.subscribePush.mockResolvedValue({ ok: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    Object.values(api).forEach((fn) => fn.mockReset())
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  })

  it('stays on when the server check fails, with a gentle note instead of an error', async () => {
    fakeBrowser({ sub: makeSub('https://web.push.apple.com/live') })
    api.getPushStatus.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.notice).toBeTruthy())
    expect(result.current.state).toBe('on')
    expect(result.current.error).toBeNull()
  })

  it('is off when the browser has no subscription, whatever the server says', async () => {
    fakeBrowser()
    api.getPushStatus.mockResolvedValue({ subscribed: true, devices: 1, lastRun: null })
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.state).toBe('off'))
  })

  it('turning on remembers it here and sends this device\'s id', async () => {
    fakeBrowser({ permission: 'default' })
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.state).toBe('off'))
    await result.current.enable()
    await waitFor(() => expect(result.current.state).toBe('on'))
    expect(localStorage.getItem('bird-alert:push-here')).toBe('on')
    expect(api.subscribePush.mock.calls[0][0].deviceId).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
})

describe('checkThisDevice', () => {
  beforeEach(() => {
    localStorage.clear()
    api.getPushPublicKey.mockResolvedValue({ publicKey: 'BFakeKeyForTests' })
    api.subscribePush.mockResolvedValue({ ok: true })
    api.getPushStatus.mockResolvedValue({ subscribed: false, knownDevice: false, devices: 0, lastRun: null })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    Object.values(api).forEach((fn) => fn.mockReset())
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  })

  it('granted, no subscription, remembered on: subscribes again without asking, and tells the switches', async () => {
    localStorage.setItem('bird-alert:push-here', 'on')
    const { pushManager } = fakeBrowser()
    const changed = vi.fn()
    window.addEventListener(PUSH_CHANGED, changed)
    expect(await checkThisDevice()).toBe('healed')
    window.removeEventListener(PUSH_CHANGED, changed)
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1)
    expect(api.subscribePush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://web.push.apple.com/new', deviceId: expect.any(String) }))
    expect(changed).toHaveBeenCalled()
  })

  it('remembered by the server only (local storage went too): heals as well', async () => {
    fakeBrowser()
    api.getPushStatus.mockResolvedValue({ subscribed: false, knownDevice: true, devices: 1, lastRun: null })
    expect(await checkThisDevice()).toBe('healed')
  })

  it('asks for a tap when the browser refuses to subscribe without one, or the permission was reset', async () => {
    localStorage.setItem('bird-alert:push-here', 'on')
    fakeBrowser({ refuse: true })
    expect(await checkThisDevice()).toBe('ask')
    fakeBrowser({ permission: 'default' })
    expect(await checkThisDevice()).toBe('ask')
  })

  it('finds the subscription on the worker running the page when the page address lookup has none', async () => {
    localStorage.setItem('bird-alert:push-here', 'on')
    fakeBrowser({ refuse: true })
    const live = makeSub('https://fcm.googleapis.com/live')
    const running = { pushManager: { getSubscription: vi.fn(async () => live), subscribe: vi.fn() } }
    const worker = navigator.serviceWorker as unknown as Record<string, unknown>
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ...worker, ready: Promise.resolve(running), controller: {} } })
    expect(await checkThisDevice()).toBe('on')
    expect(api.subscribePush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/live' }))
  })

  it('says why it asked', async () => {
    localStorage.setItem('bird-alert:push-here', 'on')
    fakeBrowser({ refuse: true })
    expect(await checkThisDevice()).toBe('ask')
    expect(lastAskReason).toMatch(/^NotAllowedError: /)
    fakeBrowser({ permission: 'default' })
    await checkThisDevice()
    expect(lastAskReason).toBe('permission default')
  })

  it('leaves alone a device that never had alerts, one turned off here, and one blocked', async () => {
    const { pushManager } = fakeBrowser()
    expect(await checkThisDevice()).toBe('none')
    localStorage.setItem('bird-alert:push-here', 'off')
    api.getPushStatus.mockResolvedValue({ subscribed: false, knownDevice: true, devices: 1, lastRun: null })
    expect(await checkThisDevice()).toBe('none')
    localStorage.setItem('bird-alert:push-here', 'on')
    fakeBrowser({ permission: 'denied' })
    expect(await checkThisDevice()).toBe('none')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('a subscribed browser the server doesn\'t know is filed again', async () => {
    fakeBrowser({ sub: makeSub('https://web.push.apple.com/live') })
    expect(await checkThisDevice()).toBe('on')
    expect(api.getPushStatus).toHaveBeenCalledWith('https://web.push.apple.com/live', expect.any(String))
    expect(api.subscribePush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://web.push.apple.com/live' }))
  })
})
