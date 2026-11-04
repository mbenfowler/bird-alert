import { type Mutation, type QueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { deleteEventTally, deleteEventTallyMark, errorMessage, postEventTally, postEventTallyMark, postEventTallyUndo, postSeenBird } from './apiCalls'
import { isNetworkError, isTransient } from './offline'
import { queryKeys } from './hooks/queries'
import type { EventTallyEntry, GroupEvent, Id } from './types'

/**
 * The day's tally, written so that no bird is lost to a canyon with no signal.
 *
 * Every add or removal is a mutation under one key and one scope: they're sent one at a time, in
 * the order they were made. With no network they wait (and are saved with the rest of the cache,
 * so a reload or an app the phone closed keeps them); with one bar that drops requests they're
 * tried again, more slowly each time, and never given up on. A pending add shows on the tally as
 * pending and can be taken off before it's sent. Each add carries a `client_id`, so the server
 * can tell a retry from a second add.
 */
export const TALLY_KEY = ['event-tally'] as const
const SCOPE = { id: 'event-tally' }

export interface TallyChange {
  id: Id
  code: string
  remove?: boolean
  /**
   * Besides an add (none) or a removal (`remove`): `undo` puts a removed bird back as it was (its
   * finder and time); `mark` and `unmark` tick or untick one bird (`tallyId`) as on one's own eBird checklist.
   */
  op?: 'undo' | 'mark' | 'unmark'
  tallyId?: Id
  /** Names this one change, for the server (adds) and for taking it back before it's sent. */
  clientId: string
  /** When it was made, and by whom: what the pending entry shows. */
  at: string
  by?: string | null
  /** Where the phone was when the bird was added (3 decimals), if the person allowed it. */
  lat?: number | null
  lng?: number | null
  /** A removal: the entry as it was, so an undo before the server answers can show it again. */
  entry?: EventTallyEntry | null
}

export interface ShownTallyEntry extends EventTallyEntry {
  /** Not yet on the server: made here, waiting to be sent. */
  pending?: boolean
  clientId?: string
}

export const newClientId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* not a secure context */ }
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`
}

/** The tally as it will be once everything waiting is sent: the server's, with pending removals gone and pending adds on top. */
export const withPending = (tally: EventTallyEntry[], pending: TallyChange[]): ShownTallyEntry[] => {
  let shown: ShownTallyEntry[] = [...tally]
  // Removals waiting to be sent, by bird: what an undo brings back while it's still waiting.
  const removed = new Map<string, EventTallyEntry>()
  for (const change of pending) {
    if (change.op === 'mark' || change.op === 'unmark') {
      shown = shown.map(entry => (entry.id !== undefined && String(entry.id) === String(change.tallyId) ? { ...entry, marked_by_me: change.op === 'mark' } : entry))
    } else if (change.op === 'undo') {
      const back = removed.get(change.code) ?? change.entry
      if (back && !shown.some(entry => entry.code === change.code)) shown = [{ ...back }, ...shown]
    } else if (change.remove) {
      const entry = shown.find(e => e.code === change.code) ?? change.entry
      if (entry) removed.set(change.code, entry)
      shown = shown.filter(e => e.code !== change.code)
    } else if (!shown.some(entry => entry.code === change.code)) {
      shown = [{
        code: change.code, added_by_you: true, added_by_name: change.by ?? null, added_at: change.at, observed_at: change.at,
        lat: change.lat ?? null, lng: change.lng ?? null, pending: true, clientId: change.clientId
      }, ...shown]
    }
  }
  return shown
}

// Adds taken back before they were sent; one already on its way is followed by a removal instead.
const cancelled = new Set<string>()
const inFlight = new Set<string>()

// "Add to life list" tapped for a bird that hasn't reached the server yet: kept until it does, and
// dropped if the add is taken back or refused, so the life list never gets a bird the tally lost.
const LIFER_KEY = 'bird-alert:lifer-after-sync'
const readLifers = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LIFER_KEY) ?? '{}') as Record<string, string> } catch { return {} }
}
const writeLifers = (lifers: Record<string, string>) => {
  try {
    if (Object.keys(lifers).length) localStorage.setItem(LIFER_KEY, JSON.stringify(lifers))
    else localStorage.removeItem(LIFER_KEY)
  } catch { /* storage unavailable */ }
}
const takeLifer = (clientId: string) => {
  const lifers = readLifers()
  const code = lifers[clientId] ?? null
  if (code) { delete lifers[clientId]; writeLifers(lifers) }
  return code
}
const dropLifer = (clientId: string) => { void takeLifer(clientId) }

const isTallyChange = (mutation: Mutation<unknown, Error, unknown, unknown>) =>
  mutation.options.mutationKey?.[0] === TALLY_KEY[0] && mutation.state.status === 'pending'

const pendingMutation = (queryClient: QueryClient, clientId: string) =>
  queryClient.getMutationCache().getAll().find(m => isTallyChange(m) && (m.state.variables as TallyChange | undefined)?.clientId === clientId)

const isEvent = (value: unknown): value is GroupEvent => Boolean(value) && typeof value === 'object' && Array.isArray((value as GroupEvent).tally) && 'id' in (value as GroupEvent)

/**
 * Puts the change into the events cache once the server has it, so the entry doesn't blink out
 * before the refetch: the server's own copy of the event when it sent one back, else the change.
 */
const applyToCache = (queryClient: QueryClient, change: TallyChange, answer?: unknown) => {
  queryClient.setQueryData<GroupEvent[]>(queryKeys.events, (events) => events?.map(event => {
    if (String(event.id) !== String(change.id)) return event
    if (isEvent(answer) && String(answer.id) === String(event.id)) {
      const { entry: _entry, ...fresh } = answer as GroupEvent & { entry?: unknown }
      return { ...event, ...fresh }
    }
    if (change.op === 'mark' || change.op === 'unmark') {
      return { ...event, tally: (event.tally ?? []).map(entry => (String(entry.id) === String(change.tallyId) ? { ...entry, marked_by_me: change.op === 'mark' } : entry)) }
    }
    const tally = (event.tally ?? []).filter(entry => entry.code !== change.code)
    if (change.remove) return { ...event, tally }
    const existing = (event.tally ?? []).find(entry => entry.code === change.code)
    if (change.op === 'undo') return { ...event, tally: existing || !change.entry ? event.tally : [change.entry, ...tally] }
    return { ...event, tally: [existing ?? { code: change.code, added_by_name: change.by ?? null, added_by_you: true, added_at: change.at, observed_at: change.at }, ...tally] }
  }))
}

/** Teaches the client how to send a tally change, so one restored after a reload can be sent too. Called once, at start-up. */
export const setupTallySync = (queryClient: QueryClient) => {
  queryClient.setMutationDefaults(TALLY_KEY, {
    mutationFn: async (change: TallyChange) => {
      if (cancelled.has(change.clientId)) return { sent: false }
      inFlight.add(change.clientId)
      try {
        const answer = change.op === 'mark' ? await postEventTallyMark(change.id, change.tallyId!)
          : change.op === 'unmark' ? await deleteEventTallyMark(change.id, change.tallyId!)
            : change.op === 'undo' ? await postEventTallyUndo(change.id, change.code)
              : change.remove ? await deleteEventTally(change.id, change.code)
                : await postEventTally(change.id, change.code, { clientId: change.clientId, observedAt: change.at, lat: change.lat, lng: change.lng })
        return { sent: true, answer }
      } finally {
        inFlight.delete(change.clientId)
      }
    },
    scope: SCOPE,
    // A dropped connection is tried again for as long as it takes; a server that's briefly down, a few times.
    retry: (failures, error) => isNetworkError(error) || (isTransient(error) && failures < 5),
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 60_000),
    onSuccess: (result: { sent: boolean; answer?: unknown }, change: TallyChange) => {
      if (!result.sent || cancelled.has(change.clientId)) return
      applyToCache(queryClient, change, result.answer)
      const lifer = change.remove || change.op ? null : takeLifer(change.clientId)
      if (lifer) void addSeen(queryClient, lifer)
    },
    onError: (error: unknown, change: TallyChange) => {
      dropLifer(change.clientId)
      toast.error(errorMessage(error), { position: 'bottom-center' })
    },
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.events }),
      queryClient.invalidateQueries({ queryKey: ['event-log'] })
    ])
  })
}

const addSeen = async (queryClient: QueryClient, code: string) => {
  try {
    await postSeenBird(code)
  } catch (error) {
    toast.error(errorMessage(error), { position: 'bottom-center' })
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.seen }),
    queryClient.invalidateQueries({ queryKey: queryKeys.places }),
    queryClient.invalidateQueries({ queryKey: ['place-seen'] })
  ])
}

/** Queues a tally change; it's sent as soon as it can be, in order. */
export const queueTallyChange = (queryClient: QueryClient, change: Omit<TallyChange, 'clientId' | 'at'> & Partial<Pick<TallyChange, 'clientId' | 'at'>>) => {
  const full: TallyChange = { clientId: newClientId(), at: new Date().toISOString(), ...change }
  void queryClient.getMutationCache().build(queryClient, { mutationKey: TALLY_KEY }).execute(full).catch(() => undefined)
  return full
}

/**
 * Takes back an add that hasn't been sent. Waiting or between retries: it's simply dropped. Already
 * on its way: a removal follows it, so it ends up off the tally either way.
 */
export const cancelPendingAdd = (queryClient: QueryClient, clientId: string) => cancelPendingChange(queryClient, clientId)

/**
 * Takes back any change that hasn't been sent (an add, a removal, a tick). Already on its way: the
 * opposite change follows it. Says whether there was one to take back.
 */
export const cancelPendingChange = (queryClient: QueryClient, clientId: string) => {
  const mutation = pendingMutation(queryClient, clientId)
  if (!mutation) return false
  const change = mutation.state.variables as TallyChange
  cancelled.add(clientId)
  dropLifer(clientId)
  const onItsWay = inFlight.has(clientId)
  queryClient.getMutationCache().remove(mutation)
  if (onItsWay) {
    const base = { id: change.id, code: change.code, by: change.by }
    if (change.op === 'mark') queueTallyChange(queryClient, { ...base, op: 'unmark', tallyId: change.tallyId })
    else if (change.op === 'unmark') queueTallyChange(queryClient, { ...base, op: 'mark', tallyId: change.tallyId })
    else if (change.op === 'undo') queueTallyChange(queryClient, { ...base, remove: true })
    else if (change.remove) queueTallyChange(queryClient, { ...base, op: 'undo', entry: change.entry })
    else queueTallyChange(queryClient, { ...base, remove: true })
  }
  return true
}

/** "Undo" after removing a bird: the waiting removal is dropped, or once sent, the bird is put back as it was. */
export const undoRemoval = (queryClient: QueryClient, removal: TallyChange) => {
  if (cancelPendingChange(queryClient, removal.clientId)) return
  queueTallyChange(queryClient, { id: removal.id, code: removal.code, op: 'undo', by: removal.by, entry: removal.entry })
}

/** What "Add to life list" does for a bird on the tally: now if the server has the add, else once it does. */
export const addLiferAfterSync = (queryClient: QueryClient, clientId: string, code: string, addNow: () => void) => {
  if (pendingMutation(queryClient, clientId)) {
    writeLifers({ ...readLifers(), [clientId]: code })
    return true
  }
  // Taken back, or refused by the server: the bird isn't on the tally, so it isn't added to the life list either.
  const refused = queryClient.getMutationCache().getAll().some(m => m.options.mutationKey?.[0] === TALLY_KEY[0] && m.state.status === 'error' && (m.state.variables as TallyChange | undefined)?.clientId === clientId)
  if (refused || cancelled.has(clientId)) return false
  addNow()
  return true
}

/**
 * Restored from storage after a reload: changes that were waiting or mid-retry are sent again (or
 * wait for the network). Called once the persisted cache is back.
 */
export const resumeTallyChanges = (queryClient: QueryClient) => Promise.all(
  queryClient.getMutationCache().getAll().filter(isTallyChange).map(m => m.continue().catch(() => undefined))
)
