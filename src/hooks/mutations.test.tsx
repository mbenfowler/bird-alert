import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToggleSavedMutation } from './mutations'
import { queryKeys } from './queries'
import type { Bird } from '../types'

vi.mock('../apiCalls', () => ({
  postSavedBird: vi.fn(),
  deleteSavedBird: vi.fn(),
  getSavedBirds: vi.fn(),
  logout: vi.fn(),
  patchUser: vi.fn()
}))

import { deleteSavedBird, postSavedBird } from '../apiCalls'

const goose: Bird = { speciesCode: 'cangoo', comName: 'Canada Goose', sciName: 'Branta canadensis' }
const swan: Bird = { speciesCode: 'tunswa', comName: 'Tundra Swan', sciName: 'Cygnus columbianus' }

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useToggleSavedMutation', () => {
  let queryClient: QueryClient
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData<Bird[]>(queryKeys.saved, [goose])
    vi.mocked(postSavedBird).mockReset()
    vi.mocked(deleteSavedBird).mockReset()
  })

  it('adds the bird to the watch list before the server answers', async () => {
    const request = deferred<Bird>()
    vi.mocked(postSavedBird).mockReturnValue(request.promise)
    const { result } = renderHook(() => useToggleSavedMutation(), { wrapper })

    act(() => result.current.mutate({ bird: swan, save: true }))

    await waitFor(() => expect(queryClient.getQueryData<Bird[]>(queryKeys.saved)).toEqual([goose, swan]))
    expect(postSavedBird).toHaveBeenCalledWith('tunswa')

    request.resolve(swan)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<Bird[]>(queryKeys.saved)).toEqual([goose, swan])
  })

  it('rolls the watch list back when the server rejects a removal', async () => {
    const request = deferred<null>()
    vi.mocked(deleteSavedBird).mockReturnValue(request.promise)
    const { result } = renderHook(() => useToggleSavedMutation(), { wrapper })

    act(() => result.current.mutate({ bird: goose, save: false }))

    await waitFor(() => expect(queryClient.getQueryData<Bird[]>(queryKeys.saved)).toEqual([]))

    request.reject(new Error('boom'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData<Bird[]>(queryKeys.saved)).toEqual([goose])
  })
})
