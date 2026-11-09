import type { QueryClient } from '@tanstack/react-query'
import { BIRDS_PER_REQUEST, birdsQueryOptions, eventDayQueries, queryKeys, speciesListOptions } from '../../hooks/queries'
import { nameLocale } from '../../i18n'
import type { Bird, EventRoute, EventRoutePlan, GroupEvent, Id } from '../../types'
import { WEEK } from '../../queryClient'

/**
 * "Get ready for offline": everything the day reads, fetched now with signal and kept on the phone
 * (the query cache, src/queryClient.ts), plus the target birds' photos (kept by the service worker,
 * public/sw.js) and a check of the app itself (also the service worker's).
 */

const PHOTO_CACHE = 'bird-alert-photos'
const readyKey = (id: Id) => `bird-alert:event-ready:${id}`

/** How long what was saved stays on the phone: the query cache's own keep-time (src/queryClient.ts). */
export const READY_FOR = WEEK

/** When this phone last saved everything for this event (every in-app line ticked). */
export const readyAt = (id: Id): number | null => {
  try { const at = Number(localStorage.getItem(readyKey(id))); return at > 0 ? at : null } catch { return null }
}
const markReady = (id: Id, at: number) => { try { localStorage.setItem(readyKey(id), String(at)) } catch { /* lasts the visit */ } }

const photoOf = (bird: Bird) => (bird.birdImg && bird.birdImg !== 'undefined' && /^https:\/\//.test(bird.birdImg) ? bird.birdImg : null)

/** The keys the tally page and the event page ask for the birds' names by. */
const nameLists = (event: GroupEvent) => {
  const targets = event.targets.map(target => target.code)
  const tally = event.tally.map(entry => entry.code)
  return [[...new Set([...tally, ...targets])].sort(), [...new Set(targets)]].filter(codes => codes.length)
}

const chunks = (codes: string[]) => Array.from({ length: Math.ceil(codes.length / BIRDS_PER_REQUEST) }, (_, i) => codes.slice(i * BIRDS_PER_REQUEST, (i + 1) * BIRDS_PER_REQUEST))

export type ReadyPart = 'event' | 'route' | 'scouting' | 'log' | 'species' | 'names' | 'photos' | 'app'

/** The checklist's in-app lines, in order; the offline map is the person's own tick, kept apart. */
export type ReadyLine = 'event' | 'tally' | 'photos' | 'app'
export const READY_LINES: ReadyLine[] = ['event', 'tally', 'photos', 'app']
const LINE_PARTS: Record<ReadyLine, ReadyPart[]> = {
  event: ['event', 'route', 'scouting', 'log'],
  tally: ['species', 'names'],
  photos: ['photos'],
  app: ['app']
}

export interface ReadyStatus {
  /** What isn't on the phone yet. */
  missing: ReadyPart[]
  /** The county's birds the tally search can find offline (0 until its list is saved). */
  species: number
  photos: { saved: number; total: number }
  /** The service worker runs this page and has the whole app saved. */
  app: 'saved' | 'saving' | 'unsupported'
  at: number | null
}

/** One checklist line is done when none of its parts is missing. */
export const lineDone = (status: ReadyStatus, line: ReadyLine) => !LINE_PARTS[line].some(part => status.missing.includes(part))

/** Ready for offline: every in-app line done. The one test, for the page's ✓ and for the saved stamp. */
export const isReady = (status: ReadyStatus) => READY_LINES.every(line => lineDone(status, line))

/** How the last save stands now: still in its week, or past it and due an update. */
export const savedState = (at: number | null, now = Date.now()): 'never' | 'fresh' | 'old' =>
  at === null ? 'never' : now - at > READY_FOR ? 'old' : 'fresh'

/** The service worker controls the page and has finished saving the app (public/sw.js stamps it). */
const appStatus = async (): Promise<ReadyStatus['app']> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof caches === 'undefined') return 'unsupported'
  try {
    if (!navigator.serviceWorker.controller) return 'saving'
    for (const name of await caches.keys()) {
      if (name.startsWith('bird-alert-shell-') && await (await caches.open(name)).match('/__installed')) return 'saved'
    }
  } catch { return 'unsupported' }
  return 'saving'
}

const savedPhotos = async (urls: string[]) => {
  if (typeof caches === 'undefined' || !urls.length) return 0
  try {
    const cache = await caches.open(PHOTO_CACHE)
    const found = await Promise.all(urls.map(url => cache.match(url, { ignoreVary: true })))
    return found.filter(Boolean).length
  } catch { return 0 }
}

const birdsFor = (queryClient: QueryClient, event: GroupEvent) => {
  const codes = new Set(event.targets.map(target => target.code))
  const all = queryClient.getQueriesData<Bird[]>({ queryKey: ['birds'] }).flatMap(([, birds]) => (Array.isArray(birds) ? birds : []))
  const found = new Map<string, Bird>()
  for (const bird of all) if (codes.has(bird.speciesCode)) found.set(bird.speciesCode, bird)
  return [...found.values()]
}

/** What's on the phone for the day now, read from the caches (no network). */
export const checkReady = async (queryClient: QueryClient, event: GroupEvent): Promise<ReadyStatus> => {
  const has = (key: readonly unknown[]) => queryClient.getQueryData(key) !== undefined
  const plan = queryClient.getQueryData<EventRoutePlan>(['event-route-plan', event.id])
  const suggested = queryClient.getQueryData<EventRoute>(['event-route', event.id, nameLocale()])
  const species = queryClient.getQueryData<string[]>(queryKeys.speciesList(event.location))
  const speciesDone = Array.isArray(species) && chunks(species).every(codes => has(queryKeys.birds(codes)))
  const birds = birdsFor(queryClient, event)
  const photos = birds.map(photoOf).filter((url): url is string => Boolean(url))
  const saved = await savedPhotos(photos)
  const app = await appStatus()
  const missing: ReadyPart[] = []
  if (!has(queryKeys.events)) missing.push('event')
  if (!plan || !suggested) missing.push('route')
  if (!has(['event-scouting', event.id, nameLocale()])) missing.push('scouting')
  if (!has(['event-log', event.id, nameLocale()])) missing.push('log')
  if (!speciesDone) missing.push('species')
  if (!nameLists(event).every(codes => has(queryKeys.birds(codes)))) missing.push('names')
  if (saved < photos.length) missing.push('photos')
  if (app !== 'saved') missing.push('app')
  return { missing, species: speciesDone ? species.length : 0, photos: { saved, total: photos.length }, app, at: readyAt(event.id) }
}

/** The step "Save for offline" is on: 1 to 4, one per checklist line. */
export interface ReadyStep { step: number; total: number; line: ReadyLine }

/**
 * Fetches everything the day needs, a checklist line at a time, telling `onStep` which; a part that
 * fails is left for the status to name. Stamps the time only when every line is done (`isReady`).
 */
export const getReady = async (queryClient: QueryClient, event: GroupEvent, onStep: (step: ReadyStep) => void = () => {}) => {
  const step = (line: ReadyLine) => onStep({ step: READY_LINES.indexOf(line) + 1, total: READY_LINES.length, line })
  const fetchFresh = (options: Parameters<QueryClient['fetchQuery']>[0]) => queryClient.fetchQuery({ ...options, staleTime: 0, retry: 1 }).catch(() => undefined)
  step('event')
  await Promise.all(eventDayQueries(event.id).map(fetchFresh))
  const fresh = queryClient.getQueryData<GroupEvent[]>(queryKeys.events)?.find(e => String(e.id) === String(event.id)) ?? event
  const normal = { ...fresh, targets: fresh.targets ?? [], tally: fresh.tally ?? [] }
  // The county's list, names and all, as the tally's bird search keeps it.
  step('tally')
  const species = await queryClient.fetchQuery(speciesListOptions(event.location)).catch(() => [] as string[])
  await Promise.all([
    ...chunks(Array.isArray(species) ? species : []).map(codes => queryClient.fetchQuery(birdsQueryOptions(codes)).catch(() => undefined)),
    ...nameLists(normal).map(codes => queryClient.fetchQuery(birdsQueryOptions(codes)).catch(() => undefined))
  ])
  // Photos: asked for the way an <img> does, so the service worker keeps them under the same address.
  step('photos')
  const photos = birdsFor(queryClient, normal).map(photoOf).filter((url): url is string => Boolean(url))
  await Promise.all(photos.map(url => fetch(url, { mode: 'no-cors', credentials: 'omit' }).catch(() => undefined)))
  step('app')
  const status = await checkReady(queryClient, normal)
  if (isReady(status)) markReady(event.id, Date.now())
  return { ...status, at: readyAt(event.id) }
}
