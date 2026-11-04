import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query'
import { ApiError, NetworkError } from './apiCalls'
import { isGone, isNetworkError } from './offline'
import { persistOptions } from './queryClient'
import { TALLY_KEY, cancelPendingAdd, queueTallyChange, resumeTallyChanges, setupTallySync, withPending, type TallyChange } from './tallySync'

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
const newClient = () => {
  const client = new QueryClient()
  setupTallySync(client)
  return client
}
const pending = (client: QueryClient) => client.getMutationCache().findAll({ mutationKey: TALLY_KEY, status: 'pending' })
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

describe('network errors', () => {
  it('tells no signal apart from a real 404 or 403', () => {
    expect(isNetworkError(new NetworkError(new TypeError('Load failed')))).toBe(true)
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new ApiError('Not found', 404))).toBe(false)
    expect(isGone(new ApiError('Not found', 404))).toBe(true)
    expect(isGone(new ApiError('Forbidden', 403))).toBe(true)
    expect(isGone(new NetworkError())).toBe(false)
  })
})

describe('withPending', () => {
  const server = [{ code: 'eletro', added_by_name: 'Matt', added_at: '2026-11-10T13:00:00Z' }]
  const change = (over: Partial<TallyChange>): TallyChange => ({ id: 2, code: 'heptan', clientId: 'c1', at: '2026-11-10T14:00:00Z', ...over })

  it('shows waiting adds as pending, hides waiting removals, and never doubles a bird', () => {
    const shown = withPending(server, [change({}), change({ code: 'eletro', clientId: 'c2' }), change({ code: 'mexchi', clientId: 'c3' }), change({ code: 'mexchi', clientId: 'c4', remove: true })])
    expect(shown.map(e => [e.code, Boolean(e.pending)])).toEqual([['heptan', true], ['eletro', false]])
    expect(shown[0]!.clientId).toBe('c1')
  })
})

describe('tally sync', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    onlineManager.setOnline(true)
  })

  it('an add made offline survives a reload and is sent once, with its client_id, when back online', async () => {
    onlineManager.setOnline(false)
    const fetchMock = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetchMock)
    const before = newClient()
    const { clientId } = queueTallyChange(before, { id: 2, code: 'heptan', by: 'Matt' })
    await settle()
    expect(pending(before)).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()

    // What the persister writes, through JSON as localStorage would hold it, into a fresh client.
    const saved = JSON.parse(JSON.stringify(dehydrate(before, persistOptions.dehydrateOptions)))
    expect(saved.mutations).toHaveLength(1)
    const after = newClient()
    // Mounted, as the provider does: it resumes paused writes when the browser comes back online.
    after.mount()
    hydrate(after, saved)
    void resumeTallyChanges(after)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(pending(after)).toHaveLength(0))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('kind=event-tally')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ species_code: 'heptan', client_id: clientId })
    after.unmount()
  })

  it('a change between retries on weak signal is saved too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')))
    const client = newClient()
    queueTallyChange(client, { id: 2, code: 'heptan' })
    await vi.waitFor(() => expect(pending(client)[0]?.state.failureCount).toBe(1))
    expect(pending(client)[0]!.state.isPaused).toBe(false)
    expect(dehydrate(client, persistOptions.dehydrateOptions).mutations).toHaveLength(1)
    client.getMutationCache().clear()
  })

  it('an add taken back before it is sent is never sent', async () => {
    onlineManager.setOnline(false)
    const fetchMock = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetchMock)
    const client = newClient()
    client.mount()
    const { clientId } = queueTallyChange(client, { id: 2, code: 'heptan' })
    await settle()
    cancelPendingAdd(client, clientId)
    expect(pending(client)).toHaveLength(0)
    onlineManager.setOnline(true)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    client.unmount()
  })
})
