import { describe, expect, it } from 'vitest'
import { appleMapUrl, boundsOf, centreOf, clampZoom, defaultMapsApp, fitZoom, googleMapUrl, MAX_ZOOM, mapArea, MIN_ZOOM, padBox, platformOf } from './offlineMaps'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

describe('the area to show', () => {
  it('boxes every valid point and skips missing ones', () => {
    expect(boundsOf([{ lat: 31.9, lng: -109.27 }, null, { lat: 31.87, lng: -109.14 }, { lat: Number.NaN, lng: 0 }]))
      .toEqual({ south: 31.87, north: 31.9, west: -109.27, east: -109.14 })
    expect(boundsOf([])).toBeNull()
    expect(boundsOf([null, undefined])).toBeNull()
  })

  it('finds the centre and grows the box evenly', () => {
    const box = { south: 31, north: 32, west: -110, east: -109 }
    expect(centreOf(box)).toEqual({ lat: 31.5, lng: -109.5 })
    const padded = padBox(box, 11.132)
    expect(padded.south).toBeCloseTo(30.9, 5)
    expect(padded.north).toBeCloseTo(32.1, 5)
    expect(padded.west).toBeLessThan(-110.1)
    expect(centreOf(padded).lat).toBeCloseTo(31.5, 5)
  })

  it('fits the zoom to the box: a smaller box zooms closer', () => {
    const wide = { south: 31, north: 32, west: -110, east: -109 } // about 95 by 110 km
    const narrow = { south: 31.4, north: 31.6, west: -109.7, east: -109.5 }
    expect(fitZoom(wide)).toBe(8)
    expect(fitZoom(narrow)).toBe(11)
    expect(fitZoom({ south: 31, north: 31, west: -110, east: -110 })).toBe(Infinity)
  })

  it('clamps the zoom to the whole-day range', () => {
    expect(clampZoom(3)).toBe(MIN_ZOOM)
    expect(clampZoom(16)).toBe(MAX_ZOOM)
    expect(clampZoom(Infinity)).toBe(MAX_ZOOM)
    expect(clampZoom(10)).toBe(10)
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([8, 12])
  })

  it('uses the route and the meeting point over the event centre', () => {
    const area = mapArea({ start: { lat: 31.95, lng: -109.3 }, stops: [{ lat: 31.9, lng: -109.27 }, { lat: 31.85, lng: -109.1 }], home: { lat: 40, lng: -100 }, rangeMi: 30 })!
    expect(area.center.lat).toBeCloseTo(31.9, 5)
    expect(area.center.lng).toBeCloseTo(-109.2, 5)
    expect(area.zoom).toBe(10)
  })

  it('falls back to the event centre and its range, then to nothing', () => {
    const area = mapArea({ stops: [], home: { lat: 31.5, lng: -110 }, rangeMi: 30 })!
    expect(area.center.lat).toBeCloseTo(31.5, 5)
    expect(area.center.lng).toBeCloseTo(-110, 5)
    expect(area.zoom).toBe(MIN_ZOOM)
    // A single stop doesn't zoom in to the street.
    expect(mapArea({ stops: [{ lat: 31.5, lng: -110 }] })!.zoom).toBe(MAX_ZOOM)
    expect(mapArea({ stops: [], home: { lat: null, lng: null } })).toBeNull()
  })
})

describe('the links', () => {
  const area = { center: { lat: 31.912345678, lng: -109.2 }, zoom: 10, box: { south: 31.8, north: 32, west: -109.3, east: -109.1 } }

  it('Google: the Maps URLs API, centred and zoomed', () => {
    expect(googleMapUrl(area)).toBe('https://www.google.com/maps/@?api=1&map_action=map&center=31.91235,-109.2&zoom=10')
    expect(googleMapUrl(null, 'Cochise, AZ')).toBe('https://www.google.com/maps/search/?api=1&query=Cochise%2C%20AZ')
  })

  it('Apple: ll and z', () => {
    expect(appleMapUrl(area)).toBe('https://maps.apple.com/?ll=31.91235,-109.2&z=10')
    expect(appleMapUrl(null, 'Cochise, AZ')).toBe('https://maps.apple.com/?q=Cochise%2C%20AZ')
  })
})

describe('which app', () => {
  it('reads the platform, the iPad asking as a Mac included', () => {
    expect(platformOf(IPHONE)).toBe('ios')
    expect(platformOf(IPAD_DESKTOP, 5)).toBe('ios')
    expect(platformOf(IPAD_DESKTOP, 0)).toBe('desktop')
    expect(platformOf(ANDROID, 5)).toBe('android')
    expect(platformOf(WINDOWS)).toBe('desktop')
  })

  it('starts iPhones on Apple, Android on Google only, and keeps a choice', () => {
    expect(defaultMapsApp('ios', null)).toBe('apple')
    expect(defaultMapsApp('ios', 'google')).toBe('google')
    expect(defaultMapsApp('android', 'apple')).toBe('google')
    expect(defaultMapsApp('desktop', null)).toBe('google')
    expect(defaultMapsApp('desktop', 'apple')).toBe('apple')
  })
})
