/* eslint-disable react-refresh/only-export-components -- this file holds the context and its hooks, no components */
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { Bird, Observation, User } from '../../types'

/** undefined: session still being checked. null: logged out. User: logged in. */
export type SessionUser = User | null | undefined

export interface BirdsContextValue {
  user: SessionUser
  setUser: Dispatch<SetStateAction<SessionUser>>
  logout: () => Promise<void>
  birds: Bird[]
  savedBirds: Bird[]
  setSavedBirds: Dispatch<SetStateAction<Bird[]>>
  savedCodes: Set<string>
  recentObservations: Observation[]
  birdAlerts: Observation[]
  currentPage: number
  setCurrentPage: (page: number) => void
  pageCount: number
  isLoaded: boolean
  handleNetworkErrors: (error: unknown) => void
}

const BirdsContext = createContext<BirdsContextValue | null>(null)

export const useBirds = (): BirdsContextValue => {
  const value = useContext(BirdsContext)
  if (!value) throw new Error('useBirds must be used inside BirdsContext.Provider')
  return value
}

/** For views that only render behind the login gate, where a user is guaranteed. */
export const useCurrentUser = (): User => {
  const { user } = useBirds()
  if (!user) throw new Error('useCurrentUser called without a logged-in user')
  return user
}

export default BirdsContext
