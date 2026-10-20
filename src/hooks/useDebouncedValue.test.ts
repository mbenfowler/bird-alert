import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only settles once the value stops changing', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: 'g' } })
    expect(result.current).toBe('g')

    rerender({ value: 'go' })
    rerender({ value: 'goo' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('g')

    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current).toBe('goo')
  })
})
