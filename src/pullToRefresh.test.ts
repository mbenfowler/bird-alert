import { describe, expect, it } from 'vitest'
import { PULL_THRESHOLD, pullState } from './pullToRefresh'

describe('pullState', () => {
  it('moves the indicator half as far as the finger, up to a stop', () => {
    expect(pullState(-20)).toEqual({ offset: 0, ready: false, turn: 0 })
    expect(pullState(60).offset).toBe(30)
    expect(pullState(1000).offset).toBe(110)
  })
  it('is ready to refresh once pulled past the threshold', () => {
    expect(pullState(PULL_THRESHOLD * 2 - 2).ready).toBe(false)
    expect(pullState(PULL_THRESHOLD * 2).ready).toBe(true)
  })
})
