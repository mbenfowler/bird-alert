import { describe, expect, it } from 'vitest'
import { arrivalFor } from './arrival'

describe('arrivalFor', () => {
  it('names the referring site, never its full address', () => {
    expect(arrivalFor('https://bird-alert.vercel.app/', 'https://l.instagram.com/?u=https%3A%2F%2Fbird-alert.vercel.app&e=secret', 1)).toEqual({ landing: 'home', ref: 'l.instagram.com', at: 1 })
  })
  it('keeps the share link landed on, and a utm tag', () => {
    expect(arrivalFor('https://bird-alert.vercel.app/share/s/jHwrtfGDai?utm_source=X', 'https://t.co/abc', 1)).toEqual({ landing: 'share-sighting', ref: 't.co', utm: 'x', share: 'jHwrtfGDai', at: 1 })
    expect(arrivalFor('https://bird-alert.vercel.app/share/r/AbCdEfGhJk', '', 1)).toEqual({ landing: 'share-route', share: 'AbCdEfGhJk', at: 1 })
  })
  it('ignores the app itself as a referrer, and never keeps a token page\'s address', () => {
    expect(arrivalFor('https://bird-alert.vercel.app/login', 'https://bird-alert.vercel.app/', 1)).toEqual({ landing: 'login', at: 1 })
    expect(arrivalFor('https://bird-alert.vercel.app/reset/abc123token', 'not a url', 1)).toEqual({ landing: 'other', at: 1 })
  })
})

describe('arrival', () => {
  it('still has this visit\'s note when the browser keeps nothing in storage (Facebook\'s in-app browser)', async () => {
    const { noteArrival, arrival } = await import('./arrival')
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    try {
      window.history.replaceState(null, '', '/?utm_source=fb-ebird')
      noteArrival()
      expect(arrival()).toMatchObject({ landing: 'home', utm: 'fb-ebird' })
    } finally {
      Object.defineProperty(window, 'localStorage', original)
    }
  })
})
