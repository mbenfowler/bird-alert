import { describe, expect, it, beforeEach } from 'vitest'
import { coverage, loadPlan, mapsUrl, move, savePlan, shortestOrder, samePlace, type PlanPoint } from './routePlan'
import type { GoPlace } from './types'

const pt = (name: string, lat: number, lng = -83.8, locId: string | null = name): PlanPoint => ({ locId, name, lat, lng })
const place = (locId: string, birds: [string, number][]): GoPlace => ({
  locId, locName: locId, lat: 34, lng: -83, isHotspot: true, merged: [], expected: 0, bestTime: null, seenToday: false,
  birds: birds.map(([speciesCode, chance]) => ({ speciesCode, comName: speciesCode, chance, band: 'Good', lastSeen: { day: '2026-10-25', time: null, subId: null, daysAgo: 1 }, note: null })) as unknown as GoPlace['birds']
})

describe('route plans', () => {
  beforeEach(() => localStorage.clear())

  it('moves a stop up and down', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    expect(move(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })

  it('finds the shortest order, from the start when given', () => {
    const [a, b, c] = [pt('a', 34.0), pt('b', 34.5), pt('c', 34.1)]
    expect(shortestOrder([b, a, c]).map(p => p.name)).toEqual(['b', 'c', 'a'])
    expect(shortestOrder([b, a, c], pt('home', 33.9)).map(p => p.name)).toEqual(['a', 'c', 'b'])
  })

  it('counts each bird once across stops, and nothing for stops off the list', () => {
    const places = [place('x', [['amerob', 50], ['norcar', 100]]), place('y', [['amerob', 50]])]
    expect(coverage([pt('x', 34), pt('y', 34)], places)).toBe(1.8)
    expect(coverage([pt('z', 34)], places)).toBe(0)
  })

  it('links Maps through the stops from the start', () => {
    const url = new URL(mapsUrl([pt('a', 34.1), pt('b', 34.2)], pt('home', 34))!)
    expect(url.searchParams.get('origin')).toBe('34,-83.8')
    expect(url.searchParams.get('waypoints')).toBe('34.1,-83.8')
    expect(url.searchParams.get('destination')).toBe('34.2,-83.8')
    expect(mapsUrl([])).toBeNull()
  })

  it('keeps a plan per county and ignores junk', () => {
    savePlan('US-GA-139', [pt('a', 34)])
    expect(loadPlan('US-GA-139')?.[0].name).toBe('a')
    expect(loadPlan('US-GA-187')).toBeNull()
    localStorage.setItem('bird-alert:route:US-GA-139', '[{"name":1}]')
    expect(loadPlan('US-GA-139')).toBeNull()
    savePlan('US-GA-139', null)
    expect(localStorage.getItem('bird-alert:route:US-GA-139')).toBeNull()
  })

  it('knows the same place by hotspot or by position', () => {
    expect(samePlace(pt('a', 34, -83, 'L1'), pt('b', 35, -83, 'L1'))).toBe(true)
    expect(samePlace(pt('a', 34, -83, null), pt('b', 34.0001, -83, null))).toBe(true)
    expect(samePlace(pt('a', 34, -83, null), pt('b', 34.1, -83, null))).toBe(false)
  })
})
