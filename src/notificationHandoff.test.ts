import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HANDOFF_CACHE, LATEST_PUSH_KEY, PENDING_OPEN_KEY, decidePending, pollInterval, samePath, takeLatestPush, takePendingOpen } from './notificationHandoff'

// A minimal Cache API: one named cache holding Response objects by key.
const store = new Map<string, Response>()
const fakeCaches = {
  open: async (name: string) => {
    expect(name).toBe(HANDOFF_CACHE)
    return {
      match: async (key: string) => store.get(key)?.clone(),
      delete: async (key: string) => store.delete(key)
    }
  }
}
const put = (key: string, record: unknown) => store.set(key, new Response(JSON.stringify(record)))

describe('notification hand-off', () => {
  beforeEach(() => { store.clear(); vi.stubGlobal('caches', fakeCaches) })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps same-origin paths and drops other origins', () => {
    expect(samePath(`${window.location.origin}/sightings?s=cangoo:S1`)).toBe('/sightings?s=cangoo:S1')
    expect(samePath('/map')).toBe('/map')
    expect(samePath('https://ebird.org/checklist/S1')).toBeNull()
    expect(samePath(42)).toBeNull()
  })

  it('hands a fresh target over exactly once', async () => {
    put(PENDING_OPEN_KEY, { url: '/sightings?s=cangoo:S1', at: Date.now() })
    expect(await takePendingOpen()).toBe('/sightings?s=cangoo:S1')
    expect(await takePendingOpen()).toBeNull()
  })

  it('ignores a stale or foreign target', async () => {
    put(PENDING_OPEN_KEY, { url: '/map', at: Date.now() - 11 * 60_000 })
    expect(await takePendingOpen()).toBeNull()
    put(PENDING_OPEN_KEY, { url: 'https://evil.example/', at: Date.now() })
    expect(await takePendingOpen()).toBeNull()
  })

  it('announces a push shown in the last minute, once', async () => {
    put(LATEST_PUSH_KEY, { title: '⭐ 2 watch list birds spotted nearby', url: '/sightings?s=a:S1,b:S2', at: Date.now() })
    expect(await takeLatestPush()).toEqual({ title: '⭐ 2 watch list birds spotted nearby', path: '/sightings?s=a:S1,b:S2' })
    expect(await takeLatestPush()).toBeNull()
  })

  it('is quiet without the Cache API', async () => {
    vi.stubGlobal('caches', undefined)
    expect(await takePendingOpen()).toBeNull()
  })
})

describe('server hand-off decisions', () => {
  const now = Date.parse('2026-10-22T15:36:10Z')
  const base = { url: '/sightings?s=a:S1', sentAt: '2026-10-22T15:36:00Z', tappedAt: null, offeredAt: null, openedAt: null }

  it('offers a fresh, unoffered push as a toast', () => {
    expect(decidePending(base, now)).toBe('offer')
  })

  it('follows a tap that the app has not yet opened, even after the toast', () => {
    expect(decidePending({ ...base, offeredAt: '2026-10-22T15:36:05Z', tappedAt: '2026-10-22T15:38:00Z' }, now + 2 * 60_000)).toBe('open')
  })

  it('does nothing once opened, when too old, or when there is no push', () => {
    expect(decidePending({ ...base, tappedAt: '2026-10-22T15:36:05Z', openedAt: '2026-10-22T15:36:06Z' }, now)).toBeNull()
    expect(decidePending(base, now + 11 * 60_000)).toBeNull()
    expect(decidePending(null, now)).toBeNull()
  })

  it('does not offer a toast for a push more than two minutes old', () => {
    expect(decidePending(base, now + 3 * 60_000)).toBeNull()
  })

  it('goes straight to a recent unopened push when the app comes to the foreground', () => {
    expect(decidePending(base, now, 'foreground')).toBe('open')
    expect(decidePending({ ...base, offeredAt: '2026-10-22T15:36:05Z' }, now + 8 * 60_000, 'foreground')).toBe('open')
    expect(decidePending({ ...base, openedAt: '2026-10-22T15:36:06Z' }, now, 'foreground')).toBeNull()
    expect(decidePending(base, now + 11 * 60_000, 'foreground')).toBeNull()
  })

  it('polls quickly while a recent push is unopened, slowly otherwise', () => {
    expect(pollInterval(base, now)).toBe(2_000)
    expect(pollInterval({ ...base, openedAt: '2026-10-22T15:36:06Z' }, now)).toBe(10_000)
    expect(pollInterval(null, now)).toBe(10_000)
  })
})
