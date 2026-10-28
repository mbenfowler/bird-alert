import { describe, expect, it } from 'vitest'
import { intensityFor } from './alertMode'

describe('intensityFor', () => {
  it('sounds the siren for ABA Code 4 and 5, the full alarm for other notables and lifers, a pulse for the rest', () => {
    expect(intensityFor('❗ ABA Code 4: Roadside Hawk reported nearby')).toBe('siren')
    expect(intensityFor('❗ ABA Code 5: Common Scoter reported nearby')).toBe('siren')
    expect(intensityFor('❗ ABA Code 3: Ruff reported nearby')).toBe('full')
    expect(intensityFor('❗ Notable: Black Scoter reported nearby')).toBe('full')
    expect(intensityFor('🎯 Lifer chance: Sedge Wren reported nearby')).toBe('full')
    expect(intensityFor('⭐ Painted Bunting spotted nearby!')).toBe('gentle')
    expect(intensityFor('🍂 First Dark-eyed Junco of the season!')).toBe('gentle')
  })
})

describe('alert sounds', () => {
  it('knows the kind of alert and the bird from the notification title', async () => {
    const { kindFor, birdFromTitle, SOUNDS, DEFAULT_SOUNDS } = await import('./alertSounds')
    expect(kindFor('❗ ABA Code 4: Roadside Hawk reported nearby')).toBe('mega')
    expect(kindFor('❗ ABA Code 3: Ruff reported nearby')).toBe('notable')
    expect(kindFor('🎯 Lifer chance: Sedge Wren reported nearby')).toBe('lifer')
    expect(kindFor('⭐ 3 watch list birds spotted nearby')).toBe('watchlist')
    expect(birdFromTitle('❗ ABA Code 4: Roadside Hawk reported nearby')).toEqual({ bird: 'Roadside Hawk', code: 4 })
    expect(birdFromTitle('❗ Notable: Black Scoter reported nearby')).toEqual({ bird: 'Black Scoter', code: null })
    expect(birdFromTitle('⭐ Painted Bunting spotted nearby!')).toEqual({ bird: 'Painted Bunting', code: null })
    expect(birdFromTitle('🍂 First Dark-eyed Junco of the season!')).toEqual({ bird: 'Dark-eyed Junco', code: null })
    expect(birdFromTitle('⭐ 3 watch list birds spotted nearby')).toEqual({ bird: 'watch list birds', code: null })
    // Every default is a real sound, and every sound id is unique.
    const ids = SOUNDS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of Object.values(DEFAULT_SOUNDS)) expect(ids).toContain(id)
  })
})

describe('bird-call clips', () => {
  it('every bird call has its clip in public/sounds/alerts and a credit', async () => {
    const { SOUNDS } = await import('./alertSounds')
    const fs = await import('node:fs')
    const calls = SOUNDS.filter((s) => s.group === 'Bird calls')
    expect(calls.length).toBeGreaterThanOrEqual(8)
    for (const s of calls) {
      expect(s.credit?.recordist, s.id).toBeTruthy()
      expect(s.credit?.license, s.id).toMatch(/^CC BY/)
    }
    const credits = fs.readFileSync('public/sounds/alerts/CREDITS.txt', 'utf8')
    for (const s of calls) expect(credits, s.id).toContain(`XC${s.credit!.xcId}`)
    for (const file of fs.readdirSync('public/sounds/alerts').filter((f) => f.endsWith('.m4a'))) expect(fs.statSync(`public/sounds/alerts/${file}`).size).toBeLessThan(120_000)
  })
})
