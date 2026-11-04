import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query'
import { ApiError, NetworkError } from './apiCalls'
import { isGone, isNetworkError } from './offline'
import { persistOptions } from './queryClient'
import { TALLY_KEY, addLiferAfterSync, cancelPendingAdd, queuePosition, queueTallyChange, resumeTallyChanges, setupTallySync, undoRemoval, withPending, type TallyChange } from './tallySync'

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

  it('shows a waiting tick, and an undo bringing a removed bird back with its finder', () => {
    const tally = [{ id: 7, code: 'eletro', added_by_name: 'Sam', added_at: '2026-11-10T13:00:00Z' }]
    expect(withPending(tally, [change({ code: 'eletro', op: 'mark', tallyId: 7 })])[0]!.marked_by_me).toBe(true)
    const removed = withPending(tally, [change({ code: 'eletro', remove: true })])
    expect(removed).toEqual([])
    const back = withPending(tally, [change({ code: 'eletro', remove: true }), change({ code: 'eletro', op: 'undo', clientId: 'c2' })])
    expect(back.map(e => [e.code, e.added_by_name])).toEqual([['eletro', 'Sam']])
    // Sent already: the server's tally lacks it, and the undo carries the entry.
    expect(withPending([], [change({ code: 'eletro', op: 'undo', entry: tally[0] })]).map(e => e.added_by_name)).toEqual(['Sam'])
  })
})

describe('the group position', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    onlineManager.setOnline(true)
  })

  it('a tap made offline survives a reload and is sent once with the time it was tapped', async () => {
    onlineManager.setOnline(false)
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()))
    vi.stubGlobal('fetch', fetchMock)
    const before = newClient()
    const tap = queuePosition(before, { id: 2, stop: 1 })
    await settle()
    const saved = JSON.parse(JSON.stringify(dehydrate(before, persistOptions.dehydrateOptions)))
    expect(saved.mutations).toHaveLength(1)
    const after = newClient()
    after.mount()
    hydrate(after, saved)
    void resumeTallyChanges(after)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('kind=event-route-position')
    expect(JSON.parse(init.body)).toEqual({ stop: 1, at: tap.at })
    after.unmount()
  })
})

describe('marks and undo', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends a tick, an untick, a removal and its undo, each to its own endpoint', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()))
    vi.stubGlobal('fetch', fetchMock)
    const client = newClient()
    queueTallyChange(client, { id: 2, code: 'eletro', op: 'mark', tallyId: 7 })
    queueTallyChange(client, { id: 2, code: 'eletro', op: 'unmark', tallyId: 7 })
    queueTallyChange(client, { id: 2, code: 'eletro', remove: true })
    queueTallyChange(client, { id: 2, code: 'eletro', op: 'undo' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    const calls = fetchMock.mock.calls.map(([url, init]) => [init.method, new URL(url, 'http://x').searchParams.get('kind'), init.body ? JSON.parse(init.body) : new URL(url, 'http://x').searchParams.get('tally_id')])
    expect(calls).toEqual([
      ['POST', 'event-tally-mark', { tally_id: 7 }],
      ['DELETE', 'event-tally-mark', '7'],
      ['DELETE', 'event-tally', null],
      ['POST', 'event-tally-undo', { species_code: 'eletro' }]
    ])
  })

  it('an undo before the removal is sent drops the removal: nothing is sent', async () => {
    onlineManager.setOnline(false)
    const fetchMock = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetchMock)
    const client = newClient()
    client.mount()
    const removal = queueTallyChange(client, { id: 2, code: 'eletro', remove: true })
    await settle()
    undoRemoval(client, removal)
    expect(pending(client)).toHaveLength(0)
    onlineManager.setOnline(true)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    client.unmount()
  })

  it('sends lat and lng with an add when it has them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetchMock)
    const client = newClient()
    queueTallyChange(client, { id: 2, code: 'heptan', lat: 31.441, lng: -110.302 })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ species_code: 'heptan', lat: 31.441, lng: -110.302 })
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
    const { clientId, at } = queueTallyChange(before, { id: 2, code: 'heptan', by: 'Matt' })
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
    const body = JSON.parse(init.body)
    // observed_at is when it was tapped, not when it got through.
    expect(body).toEqual({ species_code: 'heptan', client_id: clientId, observed_at: at })
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

  it('"Add to life list" for an add the server refuses never reaches the life list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Event is over' }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const client = newClient()
    const addNow = vi.fn()
    const { clientId } = queueTallyChange(client, { id: 2, code: 'heptan' })
    expect(addLiferAfterSync(client, clientId, 'heptan', addNow)).toBe(true)
    await vi.waitFor(() => expect(pending(client)).toHaveLength(0))
    await settle()
    expect(addNow).not.toHaveBeenCalled()
    // Only the tally POST: no life-list write followed it.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(addLiferAfterSync(client, clientId, 'heptan', addNow)).toBe(false)
  })

  it('"Add to life list" waits for the add, then adds the bird once it is on the tally', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetchMock)
    const client = newClient()
    const { clientId } = queueTallyChange(client, { id: 2, code: 'heptan' })
    addLiferAfterSync(client, clientId, 'heptan', () => undefined)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1]![0]).toContain('kind=seen')
  })
})
