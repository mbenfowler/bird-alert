import { useMemo } from 'react'
import { keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  ApiError, getBirdsByCodes, getCurrentUser, getRecentObservations, getNotableObservations, getRegions,
  getSavedBirds, getSpeciesList, searchBirds, getPushStatus, getSpeciesObservations, getArrivals, getSeasonality, getWhereToFind, getWhereToGo } from '../apiCalls'
import { DAY, MINUTE, WEEK } from '../queryClient'
import type { User } from '../types'

/** Short stable fingerprint of a code list, so a changed species list gets its own cache entry. */
export const codesKey = (codes: string[]) => {
  let hash = 5381
  for (const code of codes) for (let i = 0; i < code.length; i += 1) hash = ((hash * 33) ^ code.charCodeAt(i)) >>> 0
  return `${codes.length}-${hash.toString(36)}`
}

export const queryKeys = {
  session: ['session'] as const,
  saved: ['saved'] as const,
  speciesList: (region: string) => ['species-list', region] as const,
  birds: (codes: string[]) => ['birds', codes.join(',')] as const,
  birdPages: (region: string, codes: string[], pageSize: number) => ['bird-pages', region, codesKey(codes), pageSize] as const,
  observations: (region: string) => ['observations', region] as const,
  notable: (region: string) => ['notable', region] as const,
  regions: (state: string) => ['regions', state] as const,
  search: (term: string) => ['bird-search', term] as const,
  pushStatus: ['push-status'] as const,
  speciesObservations: (region: string, code: string) => ['species-observations', region, code] as const,
  arrivals: (region: string) => ['arrivals', region] as const,
  seasonality: (region: string, code: string) => ['seasonality', region, code] as const,
  sightings: (region: string, ids: string) => ['sightings', region, ids] as const,
  whereToFind: (region: string, code: string) => ['where-to-find', region, code] as const,
  whereToGo: (region: string, codes: string[]) => ['where-to-go', region, codesKey(codes)] as const
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
    staleTime: Infinity,
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

/** Where to go for the whole watch list. Fresh every ten minutes; nothing until the list is known. */
export const useWhereToGoQuery = (region: string, codes: string[]) =>
  useQuery({
    queryKey: queryKeys.whereToGo(region, codes),
    queryFn: () => getWhereToGo(region, codes),
    staleTime: 10 * MINUTE,
    enabled: Boolean(region) && codes.length > 0
  })
