import type { QueryClient } from '@tanstack/react-query'
import { BIRDS_PER_REQUEST, birdsQueryOptions, eventDayQueries, queryKeys, speciesListOptions } from '../../hooks/queries'
import { nameLocale } from '../../i18n'
import type { Bird, EventRoute, EventRoutePlan, GroupEvent, Id } from '../../types'
import { dayRoute } from './daySchedule'

/**
 * "Get ready for offline": everything the day reads, fetched now with signal and kept on the phone
 * (the query cache, src/queryClient.ts), plus the target birds' photos (kept by the service worker,
 * public/sw.js) and a check of the app itself (also the service worker's).
 */

const PHOTO_CACHE = 'bird-alert-photos'
const readyKey = (id: Id) => `bird-alert:event-ready:${id}`

/** When this phone last got ready for this event. */
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

export interface ReadyStatus {
  /** What isn't on the phone yet. */
  missing: ReadyPart[]
  birds: number
  stops: number
  photos: { saved: number; total: number }
  /** The service worker runs this page and has the whole app saved. */
  app: 'saved' | 'saving' | 'unsupported'
  at: number | null
}

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
  const route = dayRoute(plan, suggested)
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
  // Photos are kept by the service worker; without one (development, an old browser) the browser's own cache may hold them.
  if (app !== 'unsupported' && saved < photos.length) missing.push('photos')
  if (app !== 'saved') missing.push('app')
  return { missing, birds: event.targets.length, stops: route?.stops.length ?? 0, photos: { saved, total: photos.length }, app, at: readyAt(event.id) }
}

/** Fetches everything the day needs, all at once; a part that fails is left for the status to name. */
export const getReady = async (queryClient: QueryClient, event: GroupEvent) => {
  const fetchFresh = (options: Parameters<QueryClient['fetchQuery']>[0]) => queryClient.fetchQuery({ ...options, staleTime: 0, retry: 1 }).catch(() => undefined)
  await Promise.all(eventDayQueries(event.id).map(fetchFresh))
  const fresh = queryClient.getQueryData<GroupEvent[]>(queryKeys.events)?.find(e => String(e.id) === String(event.id)) ?? event
  const normal = { ...fresh, targets: fresh.targets ?? [], tally: fresh.tally ?? [] }
  // The county's list, names and all, as the tally's bird search keeps it.
  const species = await queryClient.fetchQuery(speciesListOptions(event.location)).catch(() => [] as string[])
  await Promise.all([
    ...chunks(Array.isArray(species) ? species : []).map(codes => queryClient.fetchQuery(birdsQueryOptions(codes)).catch(() => undefined)),
    ...nameLists(normal).map(codes => queryClient.fetchQuery(birdsQueryOptions(codes)).catch(() => undefined))
  ])
  // Photos: asked for the way an <img> does, so the service worker keeps them under the same address.
  const photos = birdsFor(queryClient, normal).map(photoOf).filter((url): url is string => Boolean(url))
  await Promise.all(photos.map(url => fetch(url, { mode: 'no-cors', credentials: 'omit' }).catch(() => undefined)))
  const status = await checkReady(queryClient, normal)
  if (!status.missing.some(part => part !== 'app' && part !== 'photos')) markReady(event.id, Date.now())
  return { ...status, at: readyAt(event.id) }
}
