import { QueryClient, type Query } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { birdsQueryOptions } from './queries'
import type { Bird } from '../types'

const bird = (speciesCode: string): Bird => ({ speciesCode, comName: speciesCode, sciName: speciesCode })

describe('birdsQueryOptions staleness', () => {
  it('keeps a complete page forever', () => {
    const client = new QueryClient()
    const options = birdsQueryOptions(['a', 'b'])
    client.setQueryData(options.queryKey, [bird('a'), bird('b')])
    const query = client.getQueryCache().find({ queryKey: options.queryKey })!
    expect(query.isStaleByTime(Infinity)).toBe(false)
    const staleTime = options.staleTime as unknown as (q: Query) => number
    expect(staleTime(query)).toBe(Infinity)
  })

  it('treats a short page as immediately stale so it is retried', () => {
    const client = new QueryClient()
    const options = birdsQueryOptions(['a', 'b', 'c'])
    client.setQueryData(options.queryKey, [bird('a')])
    const query = client.getQueryCache().find({ queryKey: options.queryKey })!
    const staleTime = options.staleTime as unknown as (q: Query) => number
    expect(staleTime(query)).toBe(0)
  })
})
