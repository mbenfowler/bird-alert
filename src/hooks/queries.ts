import { useMemo } from 'react'
import { keepPreviousData, queryOptions, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import {
  ApiError, getBirdsByCodes, getCurrentUser, getRecentObservations, getNotableObservations, getRegions, getCountries, getProvinces,
  getSavedBirds, getSpeciesList, searchBirds, getPushStatus, getSpeciesObservations, getArrivals, getSeasonality, getWhereToFind, getWhereToGo, getBestHotspots, getSpeciesHotspots, getNearbyPublic, getPlaceSearch, getDrive, getSavedRoute, getSeenBirds, getNotableThisWeek, getShare, getChase, getNameLocales } from '../apiCalls'
import { DAY, MINUTE, WEEK } from '../queryClient'
import { nameLocale } from '../i18n'
import type { PersistenceClass, User } from '../types'

/** Short stable fingerprint of a code list, so a changed species list gets its own cache entry. */
export const codesKey = (codes: string[]) => {
  let hash = 5381
  for (const code of codes) for (let i = 0; i < code.length; i += 1) hash = ((hash * 33) ^ code.charCodeAt(i)) >>> 0
  return `${codes.length}-${hash.toString(36)}`
}

// Every key but the session carries the bird-name language, so changing it fetches the names anew.
export const queryKeys = {
  session: ['session'] as const,
  get saved() { return ['saved', nameLocale()] as const },
  get seen() { return ['seen', nameLocale()] as const },
  speciesList: (region: string) => ['species-list', region, nameLocale()] as const,
  birds: (codes: string[]) => ['birds', codes.join(','), nameLocale()] as const,
  birdPages: (region: string, codes: string[], pageSize: number) => ['bird-pages', region, codesKey(codes), pageSize, nameLocale()] as const,
  observations: (region: string) => ['observations', region, nameLocale()] as const,
  notable: (region: string) => ['notable', region, nameLocale()] as const,
  regions: (state: string) => ['regions', state, nameLocale()] as const,
  search: (term: string) => ['bird-search', term, nameLocale()] as const,
  pushStatus: ['push-status'] as const,
  speciesObservations: (region: string, code: string) => ['species-observations', region, code, nameLocale()] as const,
  arrivals: (region: string) => ['arrivals', region, nameLocale()] as const,
  seasonality: (region: string, code: string) => ['seasonality', region, code, nameLocale()] as const,
  sightings: (region: string, ids: string) => ['sightings', region, ids, nameLocale()] as const,
  chase: (locId: string, code: string, cls?: string) => ['chase', locId, code, cls ?? 'rare', nameLocale()] as const,
  whereToFind: (region: string, code: string) => ['where-to-find', region, code, nameLocale()] as const,
  whereToGo: (region: string, codes: string[], from?: { lat: number; lng: number } | null) => ['where-to-go', region, codesKey(codes), from ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}` : '', nameLocale()] as const,
  bestHotspots: (region: string, days: number, species = '') => ['best-hotspots', region, days, species, nameLocale()] as const,
  savedRoute: (region: string) => ['saved-route', region, nameLocale()] as const,
  placeSearch: (state: string, q: string, addresses: boolean) => ['place-search', state, q.trim().toLowerCase(), addresses, nameLocale()] as const,
  drive: (points: { lat: number; lng: number }[]) => ['drive', points.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';'), nameLocale()] as const,
  nearby: (lat: number, lng: number) => ['nearby', lat.toFixed(3), lng.toFixed(3), nameLocale()] as const
}

/** The logged-in user, null when logged out, undefined while the cookie is being checked. */
export const useSessionQuery = () =>
  useQuery({
    queryKey: queryKeys.session,
    queryFn: async (): Promise<User | null> => {
      try {
        return await getCurrentUser()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    // Re-read when the app comes back to the foreground after a while, so a phone that kept the app
    // open for days picks up a location or alert change made on another device (#53).
    staleTime: 15 * MINUTE,
    refetchOnWindowFocus: true,
    retry: false
  })

/** For views that only render behind the login gate, where a user is guaranteed. */
export const useCurrentUser = (): User => {
  const { data } = useSessionQuery()
  if (!data) throw new Error('useCurrentUser called without a logged-in user')
  return data
}

export const useSavedBirdsQuery = () =>
  useQuery({ queryKey: queryKeys.saved, queryFn: getSavedBirds, staleTime: MINUTE })

export const useSavedCodes = (): Set<string> => {
  const { data } = useSavedBirdsQuery()
  return useMemo(() => new Set((data ?? []).map(bird => bird.speciesCode)), [data])
}

/** A county's notable reports this week, for the splash page; public and cached at the edge. */
export const useNotableThisWeekQuery = (region: string) =>
  useQuery({
    queryKey: ['notable-week', region, nameLocale()] as const,
    queryFn: () => getNotableThisWeek(region),
    staleTime: 5 * MINUTE,
    placeholderData: keepPreviousData,
    enabled: Boolean(region)
  })

/** A shared route or sighting; it never changes once made. */
export const useShareQuery = (id: string) =>
  useQuery({ queryKey: ['share', id, nameLocale()] as const, queryFn: () => getShare(id), staleTime: Infinity, retry: 1, enabled: Boolean(id) })

/** The life list. */
export const useSeenBirdsQuery = (enabled = true) =>
  useQuery({ queryKey: queryKeys.seen, queryFn: getSeenBirds, staleTime: 5 * MINUTE, enabled })

/** The life list as a set of species codes, and whether it has loaded. */
export const useSeenCodes = () => {
  const { data, isSuccess } = useSeenBirdsQuery()
  const codes = useMemo(() => new Set((data ?? []).map(bird => bird.speciesCode)), [data])
  return { codes, loaded: isSuccess }
}

/** eBird's species list for a region changes rarely; keep it for a day and persist it. */
export const useSpeciesListQuery = (region: string) =>
  useQuery({
    queryKey: queryKeys.speciesList(region),
    queryFn: () => getSpeciesList(region),
    staleTime: DAY,
    gcTime: WEEK,
    meta: { persist: true },
    enabled: Boolean(region)
  })

/**
 * Bird records are immutable once stored, so a complete page never needs refetching. A page that
 * came back short (a code the server could not resolve, or a stale cached response) is kept only
 * for the current session and retried next time, rather than persisted for a week.
 */
export const birdsQueryOptions = (codes: string[]) =>
  queryOptions({
    queryKey: queryKeys.birds(codes),
    queryFn: () => getBirdsByCodes(codes),
    staleTime: (query) => ((query.state.data?.length ?? 0) >= codes.length ? Infinity : 0),
    gcTime: WEEK,
    meta: { persist: true },
    enabled: codes.length > 0
  })

export const useBirdsQuery = (codes: string[]) =>
  useQuery({ ...birdsQueryOptions(codes), placeholderData: keepPreviousData })

/** The server looks up at most this many birds at once. */
const BIRDS_PER_REQUEST = 50

/**
 * Every bird on a region's list, names and all, fetched once in pages the server accepts and kept
 * for the week like any bird page: enough to search the list as you type without asking the server
 * per keystroke. `ready` once every page is in.
 */
export const useRegionBirds = (region: string) => {
  const speciesList = useSpeciesListQuery(region)
  const pages = useMemo(() => {
    const codes = speciesList.data ?? []
    return Array.from({ length: Math.ceil(codes.length / BIRDS_PER_REQUEST) }, (_, i) => codes.slice(i * BIRDS_PER_REQUEST, (i + 1) * BIRDS_PER_REQUEST))
  }, [speciesList.data])
  return useQueries({
    queries: pages.map(codes => birdsQueryOptions(codes)),
    combine: (results) => ({
      birds: results.flatMap(r => r.data ?? []),
      ready: Boolean(speciesList.data) && results.every(r => r.data)
    })
  })
}

export const useObservationsQuery = (region: string) =>
  useQuery({
    queryKey: queryKeys.observations(region),
    queryFn: () => getRecentObservations(region),
    staleTime: 5 * MINUTE,
    enabled: Boolean(region)
  })

export const useNotableQuery = (region: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.notable(region),
    queryFn: () => getNotableObservations(region),
    staleTime: 5 * MINUTE,
    enabled: Boolean(region) && enabled
  })

/** The languages bird names come in, each named in its own language; kept a week. */
export const useNameLocalesQuery = () =>
  useQuery({
    queryKey: ['name-locales'],
    queryFn: getNameLocales,
    staleTime: WEEK,
    gcTime: 4 * WEEK,
    meta: { persist: true }
  })

/** Every country eBird covers; kept a week, like the region lists. */
export const useCountriesQuery = (enabled = true) =>
  useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
    staleTime: WEEK,
    gcTime: 4 * WEEK,
    meta: { persist: true },
    enabled
  })

/** A country's provinces, each with the code the app keeps for it. */
export const useProvincesQuery = (country: string) =>
  useQuery({
    queryKey: ['provinces', country],
    queryFn: () => getProvinces(country),
    staleTime: WEEK,
    gcTime: 4 * WEEK,
    meta: { persist: true },
    enabled: Boolean(country)
  })

export const useRegionsQuery = (state: string) =>
  useQuery({
    queryKey: queryKeys.regions(state),
    queryFn: () => getRegions(state),
    staleTime: WEEK,
    gcTime: 4 * WEEK,
    meta: { persist: true },
    enabled: Boolean(state)
  })

export const SEARCH_MIN_LENGTH = 2

export const useBirdSearchQuery = (term: string) =>
  useQuery({
    queryKey: queryKeys.search(term),
    queryFn: () => searchBirds(term),
    staleTime: 5 * MINUTE,
    enabled: term.length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData
  })

/**
 * The region's birds as an endless list: each page is a slice of the cached species list, fetched
 * once and kept for a week. Pages already loaded render instantly on a return visit.
 */
export const useInfiniteBirdsQuery = (region: string, codes: string[], pageSize: number) =>
  useInfiniteQuery({
    queryKey: queryKeys.birdPages(region, codes, pageSize),
    queryFn: ({ pageParam }) => getBirdsByCodes(codes.slice(pageParam * pageSize, (pageParam + 1) * pageSize)),
    initialPageParam: 0,
    getNextPageParam: (_lastPage, pages) => (pages.length * pageSize < codes.length ? pages.length : undefined),
    staleTime: Infinity,
    gcTime: WEEK,
    meta: { persist: true },
    enabled: codes.length > 0
  })

/** Devices on the account and when the hourly push job last ran; refreshed each minute while shown. */
export const usePushStatusQuery = () =>
  useQuery({
    queryKey: queryKeys.pushStatus,
    queryFn: () => getPushStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000
  })

/** Every reported location of one species in the region over the last 30 days. */
export const useSpeciesObservationsQuery = (region: string, code: string) =>
  useQuery({
    queryKey: queryKeys.speciesObservations(region, code),
    queryFn: () => getSpeciesObservations(region, code),
    staleTime: 5 * MINUTE,
    enabled: Boolean(region && code)
  })

/** Species due about now that have not shown up yet; the answer only moves with the day's reports. */
export const useArrivalsQuery = (region: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.arrivals(region),
    queryFn: () => getArrivals(region),
    staleTime: 30 * MINUTE,
    gcTime: DAY,
    meta: { persist: true },
    enabled: Boolean(region) && enabled
  })

/** A species' year in the region, by month; history only grows, so a day is plenty. */
export const useSeasonalityQuery = (region: string, code: string) =>
  useQuery({
    queryKey: queryKeys.seasonality(region, code),
    queryFn: () => getSeasonality(region, code),
    staleTime: DAY,
    gcTime: WEEK,
    meta: { persist: true },
    enabled: Boolean(region && code)
  })

/** One sighting a push notification pointed at: a species and the checklist it was reported on. */
export interface SightingRef { code: string; subId: string }

/** Parses 'cangoo:S1,snogoo:S2' as it appears in a notification's link. Malformed parts are dropped. */
export const parseSightingRefs = (value: string | null): SightingRef[] =>
  (value ?? '').split(',').map((part) => {
    const [code, subId] = part.split(':')
    return code && subId && /^[a-z0-9]+$/i.test(code) && /^[A-Z0-9]+$/i.test(subId) ? { code, subId } : null
  }).filter((ref): ref is SightingRef => ref !== null)

/**
 * The observations behind a watch-list notification. eBird's species feed lists every report of a
 * species in the last 30 days, so each checklist id is looked up there; if a report has since
 * dropped out, the species' newest report stands in so the bird is still on the map.
 */
export const useSightingsQuery = (region: string, refs: SightingRef[]) =>
  useQuery({
    queryKey: queryKeys.sightings(region, refs.map((r) => `${r.code}:${r.subId}`).join(',')),
    queryFn: async () => {
      const codes = [...new Set(refs.map((r) => r.code))]
      const feeds = await Promise.all(codes.map((code) => getSpeciesObservations(region, code)))
      const byCode = new Map(codes.map((code, i) => [code, feeds[i]]))
      return refs.flatMap((ref) => {
        const feed = byCode.get(ref.code) ?? []
        const exact = feed.filter((o) => o.subId === ref.subId)
        return exact.length ? exact : feed.slice(0, 1)
      })
    },
    staleTime: 5 * MINUTE,
    enabled: Boolean(region) && refs.length > 0
  })

/** Where to find one species in the region: ranked places with evidence. Fresh every ten minutes. */
export const useWhereToFindQuery = (region: string, code: string) =>
  useQuery({
    queryKey: queryKeys.whereToFind(region, code),
    queryFn: () => getWhereToFind(region, code),
    staleTime: 10 * MINUTE,
    enabled: Boolean(region && code)
  })

/** Whether a bird is still at a place; checklists come in all day, so it's kept ten minutes. */
export const useChaseQuery = (locId: string | null | undefined, code: string, cls?: PersistenceClass, enabled = true) =>
  useQuery({
    queryKey: queryKeys.chase(locId ?? '', code, cls),
    queryFn: () => getChase(locId!, code, cls),
    staleTime: 10 * MINUTE,
    retry: 1,
    enabled: enabled && Boolean(locId && /^L\d+$/.test(locId) && code)
  })

/** Where to go for the whole watch list. Fresh every ten minutes; nothing until the list is known. */
export const useWhereToGoQuery = (region: string, codes: string[], from?: { lat: number; lng: number } | null) =>
  useQuery({
    queryKey: queryKeys.whereToGo(region, codes, from),
    queryFn: () => getWhereToGo(region, codes, from),
    staleTime: 10 * MINUTE,
    // A new starting point keeps the old route up while the new one comes in.
    placeholderData: keepPreviousData,
    enabled: Boolean(region) && codes.length > 0
  })

/** The county's hotspots ranked by species reported lately; another period keeps the last list up until it comes. */
export const useBestHotspotsQuery = (region: string, days: number, enabled = true) =>
  useQuery({
    queryKey: queryKeys.bestHotspots(region, days),
    queryFn: () => getBestHotspots(region, days),
    staleTime: 10 * MINUTE,
    placeholderData: keepPreviousData,
    enabled: enabled && Boolean(region)
  })

/** Best hotspots for one bird: where it was reported in the window, most reliably first. */
export const useSpeciesHotspotsQuery = (region: string, days: number, species: string | null) =>
  useQuery({
    // Never the every-bird key, even while no bird is picked: that would read the other ranking's cache.
    queryKey: queryKeys.bestHotspots(region, days, species ?? '-'),
    queryFn: () => getSpeciesHotspots(region, days, species!),
    staleTime: 10 * MINUTE,
    // Another period keeps the rows up while it loads; another bird never shows the last bird's.
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[3] === species ? previous : undefined,
    enabled: Boolean(region) && Boolean(species)
  })

/** The route kept on the account for this county; looked at again whenever the page is opened. */
export const useSavedRouteQuery = (region: string) =>
  useQuery({
    queryKey: queryKeys.savedRoute(region),
    queryFn: () => getSavedRoute(region),
    staleTime: 0,
    retry: 1,
    enabled: Boolean(region)
  })

/** Places by name for a route: hotspots as you type, addresses once submitted. */
export const usePlaceSearchQuery = (state: string, q: string, addresses: boolean) =>
  useQuery({
    queryKey: queryKeys.placeSearch(state, q, addresses),
    queryFn: () => getPlaceSearch(state, q.trim(), addresses),
    staleTime: DAY,
    placeholderData: keepPreviousData,
    enabled: Boolean(state) && q.trim().length >= 2
  })

/** The drive through a route of the person's own making; nothing until it has two points. */
export const useDriveQuery = (points: { lat: number; lng: number }[], enabled = true) =>
  useQuery({
    queryKey: queryKeys.drive(points),
    queryFn: () => getDrive(points),
    staleTime: DAY,
    placeholderData: keepPreviousData,
    enabled: enabled && points.length >= 2 && points.length <= 10
  })

/** Public land near a point; only once asked for (`enabled`), and kept for a day. */
export const useNearbyPublicQuery = (lat: number | null, lng: number | null, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.nearby(lat ?? 0, lng ?? 0),
    queryFn: () => getNearbyPublic(lat!, lng!),
    staleTime: DAY,
    enabled: enabled && lat !== null && lng !== null
  })
