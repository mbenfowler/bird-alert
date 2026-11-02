import { useMutation, useQueryClient } from '@tanstack/react-query'
import { releaseThisDevice } from './usePushNotifications'
import { deleteAccount, deletePlace, deletePlaceTrip, patchPlace, patchPlaceTrip, postPlace, postPlaceTrip, putPlaceSeen, putPlaceTargets, deleteSavedBird, deleteSeenBird, importLifeList, logout, patchUser, postSavedBird, postSeenBird, putSavedRoute } from '../apiCalls'
import { clearLocalRoutes } from '../routePlan'
import { queryKeys } from './queries'
import type { Bird, Id, PlaceInput, SeenBird, User } from '../types'

/** Put a freshly logged-in user into the cache so every view updates at once. */
export const useSetSession = () => {
  const queryClient = useQueryClient()
  return (user: User | null) => queryClient.setQueryData(queryKeys.session, user)
}

/** Forgets the account on this browser: the session, its lists and its routes. */
const forgetAccount = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.setQueryData(queryKeys.session, null)
  queryClient.removeQueries({ queryKey: queryKeys.saved })
  queryClient.removeQueries({ queryKey: ['saved-route'] })
  queryClient.removeQueries({ queryKey: queryKeys.seen })
  // The next person on this browser starts from their own account's route.
  clearLocalRoutes()
}

export const useLogoutMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    // This browser's alerts stop first, while the session can still say whose they were.
    mutationFn: async () => { await releaseThisDevice().catch(() => undefined); return logout() },
    // Whatever the server said, the client is logged out now.
    onSettled: () => forgetAccount(queryClient)
  })
}

/** Deletes the account for good. Only a confirmed delete forgets it here; a failure leaves the person signed in. */
export const useDeleteAccountMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => { await releaseThisDevice().catch(() => undefined); return deleteAccount() },
    onSuccess: () => forgetAccount(queryClient)
  })
}

/** Saves the route to the account; the answer becomes the cached copy for its county. */
export const useSaveRouteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: putSavedRoute,
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.savedRoute(saved.region), saved)
  })
}

/** "Seen it" on or off; the life list updates at once and settles with the server. */
export const useToggleSeenMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ speciesCode, seen }: { speciesCode: string; seen: boolean }) => (seen ? postSeenBird(speciesCode) : deleteSeenBird(speciesCode)).then(() => speciesCode),
    onMutate: async ({ speciesCode, seen }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.seen })
      const previous = queryClient.getQueryData<SeenBird[]>(queryKeys.seen) ?? []
      const next = seen
        ? (previous.some(b => b.speciesCode === speciesCode) ? previous : [...previous, { speciesCode, firstSeen: new Date().toISOString().slice(0, 10), source: 'tap' as const }])
        : previous.filter(b => b.speciesCode !== speciesCode)
      queryClient.setQueryData<SeenBird[]>(queryKeys.seen, next)
      return { previous }
    },
    onError: (_error, _variables, context) => { if (context) queryClient.setQueryData(queryKeys.seen, context.previous) },
    // At a saved place, the server adds the bird to that place's list too: its count and list refresh.
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.seen }),
      queryClient.invalidateQueries({ queryKey: queryKeys.places }),
      queryClient.invalidateQueries({ queryKey: ['place-seen'] })
    ])
  })
}

export const useImportLifeListMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: importLifeList, onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.seen }) })
}

export const usePatchUserMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: patchUser,
    onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user)
  })
}

interface ToggleSavedVariables {
  bird: Bird
  save: boolean
}

/** Add or remove a bird from the watch list, updating the list optimistically and rolling back on failure. */
export const useToggleSavedMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ bird, save }: ToggleSavedVariables) =>
      save ? postSavedBird(bird.speciesCode) : deleteSavedBird(bird.speciesCode).then(() => bird),
    onMutate: async ({ bird, save }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.saved })
      const previous = queryClient.getQueryData<Bird[]>(queryKeys.saved) ?? []
      const next = save
        ? (previous.some(b => b.speciesCode === bird.speciesCode) ? previous : [...previous, bird])
        : previous.filter(b => b.speciesCode !== bird.speciesCode)
      queryClient.setQueryData<Bird[]>(queryKeys.saved, next)
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(queryKeys.saved, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.saved })
  })
}

/** Every change to places refreshes them, and the session too, since it says which place is active. */
const usePlaceChange = <A, R>(mutationFn: (args: A) => Promise<R>) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.places }), queryClient.invalidateQueries({ queryKey: queryKeys.session })])
  })
}

/** Adds a place (every field), or changes one (just what changed). */
export const useSavePlaceMutation = () =>
  usePlaceChange((change: { id?: undefined; place: PlaceInput } | { id: Id; place: Partial<PlaceInput> }) =>
    (change.id === undefined ? postPlace(change.place as PlaceInput) : patchPlace(change.id, change.place)))

export const useDeletePlaceMutation = () => usePlaceChange((id: Id) => deletePlace(id))

export const usePlaceTargetsMutation = () => usePlaceChange(({ id, codes }: { id: Id; codes: string[] }) => putPlaceTargets(id, codes))

/** Adds dates at a place, or changes them. */
export const useSavePlaceTripMutation = () =>
  usePlaceChange(({ id, placeId, starts_on, ends_on }: { id?: Id; placeId: Id; starts_on: string; ends_on: string }) =>
    (id === undefined ? postPlaceTrip({ place_id: placeId, starts_on, ends_on }) : patchPlaceTrip(id, { starts_on, ends_on })))

export const useDeletePlaceTripMutation = () => usePlaceChange((id: Id) => deletePlaceTrip(id))

/** Sets a place's own seen list; the list and the place's count refresh. */
export const usePlaceSeenMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, codes }: { id: Id; codes: string[] }) => putPlaceSeen(id, codes),
    onSettled: (_data, _error, { id }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['place-seen', id] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.places })
    ])
  })
}
