import { describe, expect, it } from 'vitest'
import { stopFractions } from './routeDraw'

describe('stopFractions', () => {
  it('places each stop by how far along the road its nearest point is', () => {
    const path: [number, number][] = [[0, 0], [0, 1], [0, 2], [0, 4]]
    expect(stopFractions(path, [{ lat: 0, lng: 0 }, { lat: 0.01, lng: 2 }, { lat: 0, lng: 4 }])).toEqual([0, 0.5, 1])
  })
  it('without a road, spaces the stops evenly', () => {
    expect(stopFractions([], [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }])).toEqual([0, 0.5, 1])
    expect(stopFractions([], [{ lat: 0, lng: 0 }])).toEqual([1])
  })
})
