import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { ApiError } from './apiCalls'

declare module '@tanstack/react-query' {
  interface Register {
    // Queries flagged with { persist: true } survive reloads via localStorage; everything else is memory-only.
    queryMeta: { persist?: boolean }
  }
}

export const MINUTE = 60_000
export const DAY = 24 * 60 * MINUTE
export const WEEK = 7 * DAY

/** A 503 is eBird throttling us, which clears in well under a minute: keep trying for about 30 seconds. */
const busy = (error: unknown) => error instanceof ApiError && error.status === 503

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * MINUTE,
      retry: (failures, error) => failures < (busy(error) ? 3 : 1),
      retryDelay: (attempt, error) => (busy(error) ? 5000 * (attempt + 1) : Math.min(1000 * 2 ** attempt, 30_000)),
      refetchOnWindowFocus: false
    }
  }
})

const safeStorage = (): Storage | undefined => {
  try {
    const probe = '__bird_alert_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return undefined
  }
}

const persister = createSyncStoragePersister({
  storage: safeStorage(),
  key: 'bird-alert-query-cache',
  throttleTime: 1000
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: WEEK,
  // Bump to drop every reader's persisted cache after a breaking shape change.
  buster: 'v4',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.meta?.persist === true && !query.isStale()
  }
}
