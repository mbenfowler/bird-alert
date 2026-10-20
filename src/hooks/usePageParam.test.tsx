import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { usePageParam } from './usePageParam'

const withRouter = (path: string) => ({ children }: { children: ReactNode }) =>
  <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>

describe('usePageParam', () => {
  it('defaults to page one', () => {
    const { result } = renderHook(() => usePageParam(4), { wrapper: withRouter('/') })
    expect(result.current[0]).toBe(1)
  })

  it('reads the page from the URL', () => {
    const { result } = renderHook(() => usePageParam(4), { wrapper: withRouter('/?page=3') })
    expect(result.current[0]).toBe(3)
  })

  it('clamps pages past the end, so a shrunken list never points at nothing', () => {
    const { result } = renderHook(() => usePageParam(2), { wrapper: withRouter('/?page=9') })
    expect(result.current[0]).toBe(2)
  })

  it('ignores garbage', () => {
    const { result } = renderHook(() => usePageParam(3), { wrapper: withRouter('/?page=abc') })
    expect(result.current[0]).toBe(1)
  })

  it('navigates when the page is set', () => {
    const { result } = renderHook(() => usePageParam(3), { wrapper: withRouter('/') })
    act(() => result.current[1](2))
    expect(result.current[0]).toBe(2)
    act(() => result.current[1](1))
    expect(result.current[0]).toBe(1)
  })
})
