import { describe, expect, it, beforeEach } from 'vitest'
import { MAX_WAYPOINTS, coverage, loadPlan, mapsUrl, move, pathKm, routeLinks, shortestOrderLocked, savePlan, shortestOrder, samePlace, type PlanPoint } from './routePlan'
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

  it('keeps locked stops at their positions and orders the rest around them', () => {
    // Along a line north: the shortest order is a, b, c, d from the start.
    const a = pt('a', 34.1); const b = pt('b', 34.2); const c = pt('c', 34.3); const d = pt('d', 34.4)
    const home = pt('home', 34)
    expect(shortestOrderLocked([c, a, d, b], [false, false, false, false], home).map(p => p.name)).toEqual(['a', 'b', 'c', 'd'])
    // d locked at position 1 forces a longer route; the others fill in around it, as short as they can.
    const locked = shortestOrderLocked([d, c, a, b], [true, false, false, false], home)
    expect(locked.map(p => p.name)).toEqual(['d', 'c', 'b', 'a'])
    expect(pathKm(locked, home)).toBeGreaterThan(pathKm([a, b, c, d], home))
    // Two locked: c stays 2nd, b stays 4th.
    expect(shortestOrderLocked([d, c, a, b], [false, true, false, true], home).map(p => p.name)).toEqual(['a', 'c', 'd', 'b'])
    // Everything locked: unchanged.
    expect(shortestOrderLocked([d, c, b, a], [true, true, true, true], home).map(p => p.name)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('splits a long route into Google Maps links of at most three stops in between', () => {
    const stops = [1, 2, 3, 4, 5, 6].map(n => pt(`s${n}`, 34 + n / 10))
    const links = routeLinks(stops, pt('meet', 34))
    expect(links.map(l => [l.from, l.to])).toEqual([[null, 4], [4, 6]])
    for (const link of links) {
      const url = new URL(link.url)
      expect((url.searchParams.get('waypoints') ?? '').split('|').filter(Boolean).length).toBeLessThanOrEqual(MAX_WAYPOINTS)
    }
    // Each part starts where the last one ended.
    expect(new URL(links[1]!.url).searchParams.get('origin')).toBe(new URL(links[0]!.url).searchParams.get('destination'))
    expect(new URL(links[1]!.url).searchParams.get('destination')).toBe('34.6,-83.8')
  })

  it('keeps a short route as one link, and starts at stop 1 without a meeting point', () => {
    const stops = [1, 2, 3, 4, 5].map(n => pt(`s${n}`, 34 + n / 10))
    expect(routeLinks(stops).map(l => [l.from, l.to])).toEqual([[1, 5]])
    expect(new URL(routeLinks(stops)[0]!.url).searchParams.get('waypoints')!.split('|')).toHaveLength(3)
    expect(routeLinks(stops.slice(0, 1))).toHaveLength(1)
    expect(routeLinks([])).toEqual([])
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
