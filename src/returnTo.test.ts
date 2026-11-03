import { afterEach, describe, expect, it } from 'vitest'
import { forgetNext, loginHref, loginTo, nextAfterLogin, rememberNext, safeNext, storedNext } from './returnTo'

describe('safeNext', () => {
  it('keeps same-app paths with their query and hash', () => {
    expect(safeNext('/events/2')).toBe('/events/2')
    expect(safeNext('/settings?tab=alerts#push')).toBe('/settings?tab=alerts#push')
    expect(safeNext('/events/join/abc%20d')).toBe('/events/join/abc%20d')
  })
  it('refuses anything that could leave the app', () => {
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', 'evil.com', '', ' /x', '/\tevil', '/x\\y', null, undefined]) {
      expect(safeNext(bad as string)).toBeNull()
    }
  })
  it('never goes back to a sign-in page', () => {
    expect(safeNext('/login')).toBeNull()
    expect(safeNext('/login?next=/x')).toBeNull()
    expect(safeNext('/signup')).toBeNull()
    expect(safeNext('/LOGIN/')).toBeNull()
  })
})

describe('loginTo and nextAfterLogin', () => {
  afterEach(() => forgetNext())
  it('carries the path in the query and in this tab', () => {
    expect(loginTo('/events/2?x=1')).toBe('/login?next=%2Fevents%2F2%3Fx%3D1')
    expect(storedNext()).toBe('/events/2?x=1')
    expect(nextAfterLogin('?next=%2Fevents%2F2%3Fx%3D1')).toBe('/events/2?x=1')
    expect(nextAfterLogin('')).toBe('/events/2?x=1')
  })
  it('falls back to home for an unsafe next and nothing remembered', () => {
    expect(loginTo('//evil.com')).toBe('/login')
    expect(loginTo('/')).toBe('/login')
    expect(loginHref('/settings?tab=alerts')).toBe('/login?next=%2Fsettings%3Ftab%3Dalerts')
    expect(nextAfterLogin('?next=%2F%2Fevil.com')).toBe('/')
    expect(nextAfterLogin('?next=https%3A%2F%2Fevil.com')).toBe('/')
  })
  it('an unsafe query goes home, even with something remembered', () => {
    rememberNext('/go')
    expect(nextAfterLogin('?next=//evil.com')).toBe('/')
    expect(nextAfterLogin('')).toBe('/go')
  })
})
