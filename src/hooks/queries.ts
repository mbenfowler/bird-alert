import { useMemo } from 'react'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import {
  ApiError, getBirdsByCodes, getCurrentUser, getRecentObservations, getNotableObservations, getRegions,
  getSavedBirds, getSpeciesList, searchBirds
} from '../apiCalls'
import { DAY, MINUTE, WEEK } from '../queryClient'
import type { User } from '../types'

export const queryKeys = {
  session: ['session'] as const,
  saved: ['saved'] as const,
  speciesList: (region: string) => ['species-list', region] as const,
  birds: (codes: string[]) => ['birds', codes.join(',')] as const,
  observations: (region: string) => ['observations', region] as const,
  notable: (region: string) => ['notable', region] as const,
  regions: (state: string) => ['regions', state] as const,
  search: (term: string) => ['bird-search', term] as const
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
