import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HANDOFF_CACHE, LATEST_PUSH_KEY, PENDING_OPEN_KEY, samePath, takeLatestPush, takePendingOpen } from './notificationHandoff'

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
    put(PENDING_OPEN_KEY, { url: '/map', at: Date.now() - 6 * 60_000 })
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
