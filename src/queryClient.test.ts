import { describe, expect, it } from 'vitest'
import { ApiError } from './apiCalls'
import { queryClient } from './queryClient'

describe('retries', () => {
  const { retry, retryDelay } = queryClient.getDefaultOptions().queries as { retry: (n: number, e: unknown) => boolean; retryDelay: (n: number, e: unknown) => number }
  it('keeps trying for about 30 seconds while eBird is busy, and once for anything else', () => {
    const busy = new ApiError('eBird is busy right now. Trying again in a moment.', 503)
    expect([0, 1, 2, 3].map(n => retry(n, busy))).toEqual([true, true, true, false])
    expect([0, 1, 2].reduce((ms, n) => ms + retryDelay(n, busy), 0)).toBe(30_000)
    expect([0, 1].map(n => retry(n, new ApiError('Nope', 500)))).toEqual([true, false])
  })
})
