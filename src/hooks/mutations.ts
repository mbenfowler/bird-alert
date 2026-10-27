import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSavedBird, logout, patchUser, postSavedBird, putSavedRoute } from '../apiCalls'
import { clearLocalRoutes } from '../routePlan'
import { queryKeys } from './queries'
import type { Bird, User } from '../types'

/** Put a freshly logged-in user into the cache so every view updates at once. */
export const useSetSession = () => {
  const queryClient = useQueryClient()
  return (user: User | null) => queryClient.setQueryData(queryKeys.session, user)
}

export const useLogoutMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    // Whatever the server said, the client is logged out now.
    onSettled: () => {
      queryClient.setQueryData(queryKeys.session, null)
      queryClient.removeQueries({ queryKey: queryKeys.saved })
      queryClient.removeQueries({ queryKey: ['saved-route'] })
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
