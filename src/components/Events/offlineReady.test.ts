import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { GroupEvent } from '../../types'
import { getReady, isReady, lineDone, READY_FOR, readyAt, savedState, type ReadyStatus, type ReadyStep } from './offlineReady'

// The day's fetches, answered at once: the event list, the route plan and suggestion, scouting and the log.
const EVENT = { id: 9, location: 'US-AZ-003', targets: [{ code: 'eletro' }, { code: 'heptan' }], tally: [{ code: 'eletro' }] } as unknown as GroupEvent
const birds = (codes: string[]) => codes.map(code => ({ speciesCode: code, comName: code, birdImg: `https://img.test/${code}.jpg` }))
let failEvents = false

vi.mock('../../hooks/queries', async (original) => {
  const real = await original<typeof import('../../hooks/queries')>()
  return {
    ...real,
    eventDayQueries: (id: number) => [
      { queryKey: real.queryKeys.events, queryFn: async () => { if (failEvents) throw new Error('no signal'); return [EVENT] } },
      { queryKey: ['event-route-plan', id], queryFn: async () => ({ start: null, stops: null }) },
      { queryKey: ['event-route', id, 'en'], queryFn: async () => ({ stops: [] }) },
      { queryKey: ['event-scouting', id, 'en'], queryFn: async () => ({}) },
      { queryKey: ['event-log', id, 'en'], queryFn: async () => ({ entries: [] }) }
    ],
    speciesListOptions: (region: string) => ({ queryKey: real.queryKeys.speciesList(region), queryFn: async () => ['eletro', 'heptan', 'mexchi'] }),
    birdsQueryOptions: (codes: string[]) => ({ queryKey: real.queryKeys.birds(codes), queryFn: async () => birds(codes) })
  }
})
vi.mock('../../i18n', async (original) => ({ ...(await original<object>()), nameLocale: () => 'en' }))

const status = (missing: ReadyStatus['missing']): ReadyStatus => ({ missing, species: 3, photos: { saved: 2, total: 2 }, app: 'saved', at: null })

/** A service worker that runs the page and has the app and every photo saved (or the app still saving). */
const worker = (app: 'saved' | 'saving') => {
  Object.defineProperty(navigator, 'serviceWorker', { value: { controller: app === 'saved' ? {} : null }, configurable: true })
  vi.stubGlobal('caches', {
    keys: async () => ['bird-alert-shell-abc', 'bird-alert-photos'],
    open: async () => ({ match: async () => new Response('') })
  })
}

describe('the checklist', () => {
  it('a line is done when none of its parts is missing; ready needs every in-app line', () => {
    expect(isReady(status([]))).toBe(true)
    expect(lineDone(status(['scouting']), 'event')).toBe(false)
    expect(lineDone(status(['scouting']), 'tally')).toBe(true)
    expect(lineDone(status(['names']), 'tally')).toBe(false)
    for (const part of ['route', 'species', 'photos', 'app'] as const) expect(isReady(status([part]))).toBe(false)
  })

  it('a save lasts the query cache\'s week, then wants an update', () => {
    expect(READY_FOR).toBe(7 * 24 * 60 * 60 * 1000)
    const at = Date.UTC(2026, 10, 2, 2, 42)
    expect(savedState(null, at)).toBe('never')
    expect(savedState(at, at + READY_FOR - 1)).toBe('fresh')
    expect(savedState(at, at + READY_FOR + 1)).toBe('old')
  })
})

describe('getReady', () => {
  beforeEach(() => {
    failEvents = false
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('')))
  })
  afterEach(() => { vi.unstubAllGlobals(); delete (navigator as { serviceWorker?: unknown }).serviceWorker })

  it('reports each step, ticks every line, and stamps the time only then', async () => {
    worker('saved')
    const steps: ReadyStep[] = []
    const result = await getReady(new QueryClient(), EVENT, step => steps.push(step))
    expect(steps).toEqual([
      { step: 1, total: 4, line: 'event' },
      { step: 2, total: 4, line: 'tally' },
      { step: 3, total: 4, line: 'photos' },
      { step: 4, total: 4, line: 'app' }
    ])
    expect(result.missing).toEqual([])
    expect(result.species).toBe(3)
    expect(result.photos).toEqual({ saved: 2, total: 2 })
    expect(isReady(result)).toBe(true)
    expect(result.at).not.toBeNull()
    expect(readyAt(EVENT.id)).toBe(result.at)
  })

  it('with the app still saving, nothing is stamped: the page and the stamp agree', async () => {
    worker('saving')
    const result = await getReady(new QueryClient(), EVENT)
    expect(result.missing).toEqual(['app'])
    expect(result.app).toBe('saving')
    expect(isReady(result)).toBe(false)
    expect(result.at).toBeNull()
    expect(readyAt(EVENT.id)).toBeNull()
  })

  it('a part that fails leaves its line unticked and the old stamp alone', async () => {
    worker('saved')
    localStorage.setItem(`bird-alert:event-ready:${EVENT.id}`, '1000')
    failEvents = true
    const result = await getReady(new QueryClient(), EVENT)
    expect(lineDone(result, 'event')).toBe(false)
    expect(lineDone(result, 'tally')).toBe(true)
    expect(result.at).toBe(1000)
  })
})
