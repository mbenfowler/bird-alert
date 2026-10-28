import { useMutation, useQueryClient } from '@tanstack/react-query'
import { releaseThisDevice } from './usePushNotifications'
import { deleteSavedBird, deleteSeenBird, importLifeList, logout, patchUser, postSavedBird, postSeenBird, putSavedRoute } from '../apiCalls'
import { clearLocalRoutes } from '../routePlan'
import { queryKeys } from './queries'
import type { Bird, SeenBird, User } from '../types'

/** Put a freshly logged-in user into the cache so every view updates at once. */
export const useSetSession = () => {
  const queryClient = useQueryClient()
  return (user: User | null) => queryClient.setQueryData(queryKeys.session, user)
}

export const useLogoutMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    // This browser's alerts stop first, while the session can still say whose they were.
    mutationFn: async () => { await releaseThisDevice().catch(() => undefined); return logout() },
    // Whatever the server said, the client is logged out now.
    onSettled: () => {
      queryClient.setQueryData(queryKeys.session, null)
      queryClient.removeQueries({ queryKey: queryKeys.saved })
      queryClient.removeQueries({ queryKey: ['saved-route'] })
      queryClient.removeQueries({ queryKey: queryKeys.seen })
      // The next person on this browser starts from their own account's route.
      clearLocalRoutes()
    }
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.seen })
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
