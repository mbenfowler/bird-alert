import { useMutationState, type QueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ApiError, errorMessage, postEventRoutePosition, putEventRoutePlan } from './apiCalls'
import { isNetworkError, isTransient } from './offline'
import { nameLocale } from './i18n'
import { newClientId } from './tallySync'
import type { EventRoute, EventRoutePlan, Id, RoutePosition, RoutePlanStop } from './types'

/**
 * The group's route, written so an edit in a canyon isn't lost: each save of the route and each
 * "We're here" is queued like a tally change (src/tallySync.ts): kept through a reload, tried
 * again until it gets through, sent one at a time in the order made (one scope for both, so a
 * suggestion saved as the group's route always reaches the server before a position on it).
 */
export const ROUTE_SAVE_KEY = ['event-route-save'] as const
export const POSITION_KEY = ['event-position'] as const
export const ROUTE_KEYS: string[] = [ROUTE_SAVE_KEY[0], POSITION_KEY[0]]
const SCOPE = { id: 'event-route' }

type Start = EventRoutePlan['start']
type SavedStop = Pick<RoutePlanStop, 'locId' | 'name' | 'lat' | 'lng' | 'stay_min' | 'locked'>

export interface RouteSave {
  id: Id
  clientId: string
  start: Start
  stops: SavedStop[] | null
  /** The version the edit was made on. */
  baseVersion: number
}

export interface PositionChange {
  id: Id
  /** 0-based stop; -1 the meeting point; null not started (Start over). */
  stop: number | null
  /** When it was tapped: the server keeps the latest tap, not the last to arrive. */
  at: string
  clientId: string
  /** The route as it stood (the suggestion), to save as the group's first if it has none yet. */
  ensure?: { start: Start; stops: SavedStop[] } | null
}

const planKey = (id: Id) => ['event-route-plan', id] as const
const noteKey = (id: Id) => ['event-route-note', id] as const

const isPlan = (v: unknown): v is EventRoutePlan => Boolean(v) && typeof v === 'object' && typeof (v as EventRoutePlan).version === 'number'
/** A 409's answer: the record someone else saved since. */
export const theirs = (error: unknown): EventRoutePlan | null => {
  const current = error instanceof ApiError && error.status === 409 && error.data && typeof error.data === 'object' ? (error.data as { current?: unknown }).current : null
  return isPlan(current) ? current : null
}

/** A queued save made on version N, sent after our own earlier save moved the record on: it goes as the newer version. */
const rebased = new Map<string, { from: number; to: number }>()
const inFlight = new Set<string>()

const retry = (failures: number, error: unknown) => isNetworkError(error) || (isTransient(error) && failures < 5)
const retryDelay = (attempt: number) => Math.min(2000 * 2 ** attempt, 60_000)

/** The suggestion's stops as the group's own, for a route that has none saved yet. */
export const suggestionAsRoute = (queryClient: QueryClient, id: Id) => {
  const plan = queryClient.getQueryData<EventRoutePlan>(planKey(id))
  const suggested = queryClient.getQueryData<EventRoute>(['event-route', id, nameLocale()])
  const stops = Array.isArray(suggested?.stops) ? suggested.stops : []
  if (!stops.length) return null
  return {
    start: plan?.start ?? null,
    stops: stops.map(s => ({ locId: s.locId || null, name: s.locName, lat: s.lat, lng: s.lng, stay_min: s.stay_min ?? null }))
  }
}

/** Saves the suggestion as the group's route (version 0), unless someone already saved one. */
const saveFirst = async (queryClient: QueryClient, id: Id, ensure: NonNullable<PositionChange['ensure']>) => {
  const plan = queryClient.getQueryData<EventRoutePlan>(planKey(id))
  if (plan?.stops) return
  try {
    queryClient.setQueryData(planKey(id), await putEventRoutePlan(id, { start: ensure.start, stops: ensure.stops as EventRoutePlan['stops'], version: plan?.version ?? 0 }))
  } catch (error) {
    const current = theirs(error)
    if (current) queryClient.setQueryData(planKey(id), current)
    else throw error
  }
}

const isRouteNotSaved = (error: unknown) => error instanceof ApiError && error.status === 409

export const setupRouteSync = (queryClient: QueryClient) => {
  queryClient.setMutationDefaults(ROUTE_SAVE_KEY, {
    mutationFn: async (change: RouteSave) => {
      const step = rebased.get(String(change.id))
      const version = step && step.from === change.baseVersion ? step.to : change.baseVersion
      inFlight.add(change.clientId)
      try {
        const stops = change.stops?.map(({ locId, name, lat, lng, stay_min, locked }) => ({ locId, name, lat, lng, stay_min: stay_min ?? null, ...(locked ? { locked: true } : {}) })) ?? null
        const record = await putEventRoutePlan(change.id, { start: change.start, stops, version })
        rebased.set(String(change.id), { from: change.baseVersion, to: record.version })
        const before = queryClient.getQueryData<EventRoutePlan>(planKey(change.id))
        queryClient.setQueryData(planKey(change.id), { ...record, position: record.position !== undefined ? record.position : before?.position ?? null })
        return { saved: true }
      } catch (error) {
        // Someone else saved since: theirs stands, this edit is dropped, and the page says whose it is.
        const current = theirs(error)
        if (!current) throw error
        rebased.delete(String(change.id))
        queryClient.setQueryData(planKey(change.id), current)
        queryClient.setQueryData(noteKey(change.id), current)
        dropWaitingSaves(queryClient, change.id)
        return { saved: false }
      } finally {
        inFlight.delete(change.clientId)
      }
    },
    scope: SCOPE,
    // An edit is never given up on for a dropped connection or a server that's briefly down: it stays on screen, saving.
    retry: (_failures: number, error: unknown) => isTransient(error),
    retryDelay,
    onError: (error: unknown) => { toast.error(errorMessage(error), { position: 'bottom-center' }) },
    // The suggestion starts at the saved meeting point.
    onSettled: (_d: unknown, _e: unknown, change: RouteSave) => queryClient.invalidateQueries({ queryKey: ['event-route', change.id] })
  })

  queryClient.setMutationDefaults(POSITION_KEY, {
    mutationFn: async (change: PositionChange) => {
      const send = () => postEventRoutePosition(change.id, { stop: change.stop, at: change.at })
      if (change.ensure && change.stop !== null) await saveFirst(queryClient, change.id, change.ensure)
      let answer: unknown
      try {
        answer = await send()
      } catch (error) {
        // "The route isn't saved yet" (someone went back to the suggestion meanwhile): save it, then try again.
        const ensure = change.ensure ?? suggestionAsRoute(queryClient, change.id)
        if (!isRouteNotSaved(error) || !ensure) throw error
        queryClient.setQueryData<EventRoutePlan>(planKey(change.id), (plan) => (plan ? { ...plan, stops: null } : plan))
        await saveFirst(queryClient, change.id, ensure)
        answer = await send()
      }
      // The server's answer stands: this tap, or a newer one that already won (applied: false).
      const position = answer && typeof answer === 'object' && 'position' in answer ? (answer as { position: RoutePosition | null }).position : undefined
      if (position !== undefined) queryClient.setQueryData<EventRoutePlan>(planKey(change.id), (plan) => (plan ? { ...plan, position } : plan))
      return answer
    },
    scope: SCOPE,
    retry,
    retryDelay,
    onError: (error: unknown) => { toast.error(errorMessage(error), { position: 'bottom-center' }) },
    onSettled: (_d: unknown, _e: unknown, change: PositionChange) => queryClient.invalidateQueries({ queryKey: planKey(change.id) })
  })
}

const waitingSaves = (queryClient: QueryClient, id: Id) => queryClient.getMutationCache().getAll()
  .filter(m => m.options.mutationKey?.[0] === ROUTE_SAVE_KEY[0] && m.state.status === 'pending')
  .filter(m => { const v = m.state.variables as RouteSave | undefined; return v && String(v.id) === String(id) && !inFlight.has(v.clientId) })

const dropWaitingSaves = (queryClient: QueryClient, id: Id) => {
  for (const m of waitingSaves(queryClient, id)) queryClient.getMutationCache().remove(m)
}

/**
 * Queues a save of the whole route. Saves still waiting for the same event are replaced by this
 * one (it holds them all), keeping the version they were made on.
 */
export const queueRouteSave = (queryClient: QueryClient, change: Omit<RouteSave, 'clientId'>) => {
  const waiting = waitingSaves(queryClient, change.id)
  const baseVersion = waiting.length ? (waiting[0]!.state.variables as RouteSave).baseVersion : change.baseVersion
  for (const m of waiting) queryClient.getMutationCache().remove(m)
  const full: RouteSave = { ...change, baseVersion, clientId: newClientId() }
  void queryClient.getMutationCache().build(queryClient, { mutationKey: ROUTE_SAVE_KEY }).execute(full).catch(() => undefined)
  return full
}

/** Drops route saves not yet sent (going back to the suggestion makes them moot). */
export const cancelRouteSaves = (queryClient: QueryClient, id: Id) => dropWaitingSaves(queryClient, id)

/** The latest save of this event's route that hasn't reached the server, if any. */
export const usePendingRouteSave = (id: Id): RouteSave | null => {
  const pending = useMutationState({ filters: { mutationKey: ROUTE_SAVE_KEY, status: 'pending' }, select: (m) => m.state.variables as RouteSave })
    .filter(change => change && String(change.id) === String(id))
  return pending.length ? pending[pending.length - 1]! : null
}

/** Queues a position tap for the group; sent as soon as it can be, after any route save before it. */
export const queuePosition = (queryClient: QueryClient, change: Omit<PositionChange, 'clientId' | 'at'> & Partial<Pick<PositionChange, 'at'>>) => {
  const full: PositionChange = { clientId: newClientId(), at: new Date().toISOString(), ...change }
  void queryClient.getMutationCache().build(queryClient, { mutationKey: POSITION_KEY }).execute(full).catch(() => undefined)
  return full
}

/** This phone's latest position tap for the event that hasn't reached the server yet, if any. */
export const usePendingPosition = (id: Id | undefined): PositionChange | null => {
  const pending = useMutationState({ filters: { mutationKey: POSITION_KEY, status: 'pending' }, select: (m) => m.state.variables as PositionChange })
    .filter(change => change && id !== undefined && String(change.id) === String(id))
  return pending.length ? pending[pending.length - 1]! : null
}

export const routeNoteKey = noteKey
