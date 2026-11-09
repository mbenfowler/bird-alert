import { afterEach, describe, expect, it } from 'vitest'
import { canGoBack, forgetPages, recall, remember } from './pageMemory'

describe('page memory', () => {
  afterEach(() => { sessionStorage.clear() })

  it('keeps a value per history entry', () => {
    remember('abc', 'alertsTab', 'notable')
    expect(recall('abc', 'alertsTab')).toBe('notable')
    expect(recall('xyz', 'alertsTab')).toBeUndefined()
  })

  it('reads nothing back from a value it cannot parse', () => {
    sessionStorage.setItem('bird-alert:page:abc:alertsTab', '{not json')
    expect(recall('abc', 'alertsTab')).toBeUndefined()
  })

  it('a new load of the app forgets every page, and nothing else', () => {
    remember('abc', 'search', 'goose')
    sessionStorage.setItem('bird-alert:next', '/events/2')
    forgetPages()
    expect(recall('abc', 'search')).toBeUndefined()
    expect(sessionStorage.getItem('bird-alert:next')).toBe('/events/2')
  })
})

describe('canGoBack', () => {
  it('is false on the first page of a tab, or one opened by a link from outside', () => {
    expect(canGoBack(null)).toBe(false)
    expect(canGoBack({ idx: 0 })).toBe(false)
    expect(canGoBack({})).toBe(false)
  })

  it('is true once the app has moved on from its first page', () => {
    expect(canGoBack({ idx: 1, key: 'k1' })).toBe(true)
    expect(canGoBack({ idx: 4 })).toBe(true)
  })
})
