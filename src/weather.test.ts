import { describe, expect, it } from 'vitest'
import { covers, forecastUrl, forecastWindow, kindOf, parseForecast, pickHour, speedIn, tempIn, wallClock, weatherAt } from './weather'

describe('kindOf (WMO weather code to icon)', () => {
  it('maps each group of codes', () => {
    expect(kindOf(0)).toBe('clear')
    expect(kindOf(1)).toBe('clear')
    expect(kindOf(0, null, false)).toBe('clearNight')
    expect(kindOf(2)).toBe('partly')
    expect(kindOf(2, 0, false)).toBe('cloudy')
    expect(kindOf(3)).toBe('cloudy')
    expect(kindOf(45)).toBe('fog')
    expect(kindOf(48)).toBe('fog')
    for (const code of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]) expect(kindOf(code)).toBe('rain')
    for (const code of [71, 73, 75, 77, 85, 86]) expect(kindOf(code)).toBe('snow')
    for (const code of [95, 96, 99]) expect(kindOf(code)).toBe('storm')
  })
  it('shows the wind for a dry sky with strong gusts, never over rain or storms', () => {
    expect(kindOf(0, 45)).toBe('wind')
    expect(kindOf(3, 40)).toBe('wind')
    expect(kindOf(0, 39)).toBe('clear')
    expect(kindOf(61, 60)).toBe('rain')
    expect(kindOf(95, 60)).toBe('storm')
  })
  it('has nothing for an unknown or missing code', () => {
    expect(kindOf(null)).toBeNull()
    expect(kindOf(undefined)).toBeNull()
    expect(kindOf(42)).toBeNull()
  })
})

describe('pickHour', () => {
  const times = ['2026-11-10T04:00', '2026-11-10T05:00', '2026-11-10T06:00', '2026-11-10T07:00']
  it('picks the nearest hour', () => {
    expect(pickHour(times, '2026-11-10T05:20')).toBe(1)
    expect(pickHour(times, '2026-11-10T05:40')).toBe(2)
    expect(pickHour(times, '2026-11-10T06:00')).toBe(2)
  })
  it('has none when no hour is within an hour', () => {
    expect(pickHour(times, '2026-11-10T08:30')).toBeNull()
    expect(pickHour(times, '2026-11-11T05:00')).toBeNull()
    expect(pickHour([], '2026-11-10T05:00')).toBeNull()
  })
  it('reads a moment as the wall clock in the event zone', () => {
    // 12:40 UTC is 5:40 AM in Arizona (no daylight saving).
    expect(wallClock(new Date('2026-11-10T12:40:00Z'), 'America/Phoenix')).toBe('2026-11-10T05:40')
    expect(wallClock(new Date('2026-11-10T07:05:00Z'), 'America/Phoenix')).toBe('2026-11-10T00:05')
  })
})

describe('forecastWindow', () => {
  it('asks for the day and the morning after, today through 16 days out', () => {
    expect(forecastWindow('2026-11-10', '2026-11-09')).toEqual({ start: '2026-11-10', end: '2026-11-11' })
    expect(forecastWindow('2026-11-09', '2026-11-09')).toEqual({ start: '2026-11-09', end: '2026-11-10' })
    expect(forecastWindow('2026-11-24', '2026-11-09')).toEqual({ start: '2026-11-24', end: '2026-11-24' })
  })
  it('has none for a past day or one beyond the forecast', () => {
    expect(forecastWindow('2026-11-08', '2026-11-09')).toBeNull()
    expect(forecastWindow('2026-11-25', '2026-11-09')).toBeNull()
    expect(forecastWindow('', '2026-11-09')).toBeNull()
  })
})

describe('the forecast', () => {
  const points = [{ lat: 31.5455, lng: -110.2773 }, { lat: 31.8834, lng: -109.2064 }]
  const hourly = (temp: number) => ({ time: ['2026-11-10T05:00', '2026-11-10T06:00'], temperature_2m: [temp, temp + 1], precipitation_probability: [0, 20], weather_code: [0, 2], wind_speed_10m: [5, 10], wind_gusts_10m: [10, 50], is_day: [0, 1] })
  const weather = { day: '2026-11-10', points: parseForecast([{ hourly: hourly(4) }, { hourly: hourly(1) }], points) }

  it('asks for every place in one request, coordinates only', () => {
    const url = new URL(forecastUrl(points, { start: '2026-11-10', end: '2026-11-11' }, 'America/Phoenix'))
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')).toBe('31.5455,31.8834')
    expect(url.searchParams.get('longitude')).toBe('-110.2773,-109.2064')
    expect(url.searchParams.get('timezone')).toBe('America/Phoenix')
    expect(url.searchParams.get('start_date')).toBe('2026-11-10')
    expect(url.searchParams.get('hourly')).toContain('weather_code')
  })
  it('reads one place answered as an object', () => {
    expect(parseForecast({ hourly: hourly(3) }, [points[0]!])[0]!.temp).toEqual([3, 4])
  })
  it('finds a place at a moment', () => {
    expect(weatherAt(weather, points[1]!, new Date('2026-11-10T12:10:00Z'), 'America/Phoenix')).toEqual({ kind: 'clearNight', tempC: 1, windKmh: 5, gustKmh: 10, rain: 0 })
    expect(weatherAt(weather, points[0]!, new Date('2026-11-10T13:00:00Z'), 'America/Phoenix')).toEqual({ kind: 'wind', tempC: 5, windKmh: 10, gustKmh: 50, rain: 20 })
    expect(weatherAt(weather, { lat: 32, lng: -110 }, new Date('2026-11-10T12:10:00Z'), 'America/Phoenix')).toBeNull()
    expect(weatherAt(null, points[0]!, new Date(), 'America/Phoenix')).toBeNull()
  })
  it('knows when a changed route needs asking again', () => {
    expect(covers(weather, points)).toBe(true)
    expect(covers(weather, [...points, { lat: 32, lng: -110 }])).toBe(false)
    expect(covers(null, points)).toBe(false)
  })
  it('shows in the viewer units', () => {
    expect(tempIn(5, 'mi')).toBe(41)
    expect(tempIn(5, 'km')).toBe(5)
    expect(speedIn(40, 'mi')).toBe(25)
    expect(speedIn(40, 'km')).toBe(40)
  })
})
