import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

declare module '@tanstack/react-query' {
  interface Register {
    // Queries flagged with { persist: true } survive reloads via localStorage; everything else is memory-only.
    queryMeta: { persist?: boolean }
  }
}

export const MINUTE = 60_000
export const DAY = 24 * 60 * MINUTE
export const WEEK = 7 * DAY

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * MINUTE,
      retry: 1,
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
