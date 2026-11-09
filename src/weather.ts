/**
 * The forecast at each stop of an event's route, from Open-Meteo (free, no key, asked from the
 * browser). Only the stops' coordinates and the day go out; nothing about the user. One request
 * covers every stop (Open-Meteo takes lists of latitudes and longitudes). Kept metric as it comes
 * and shown in the viewer's units.
 */
import type { DistanceUnit } from './distance'

export type WeatherKind = 'clear' | 'clearNight' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' | 'wind'

/** Gusts from about 25 mph (40 km/h) make the wind the thing to know. */
export const GUSTY_KMH = 40

/** Open-Meteo forecasts 16 days ahead, today included. */
export const FORECAST_DAYS = 16

/**
 * The WMO weather code as one of the icons: clear (day or night), partly cloudy, cloudy, fog,
 * drizzle or rain, snow, thunderstorm; a dry sky with strong gusts shows the wind instead.
 */
export const kindOf = (code: number | null | undefined, gustKmh?: number | null, isDay = true): WeatherKind | null => {
  if (typeof code !== 'number' || !Number.isFinite(code)) return null
  const gusty = typeof gustKmh === 'number' && gustKmh >= GUSTY_KMH
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (gusty) return 'wind'
  if (code === 3) return 'cloudy'
  if (code === 2) return isDay ? 'partly' : 'cloudy'
  if (code === 0 || code === 1) return isDay ? 'clear' : 'clearNight'
  return null
}

export interface Point { lat: number; lng: number }

/** One place's hours, in Open-Meteo's own units (°C, km/h, %), local wall-clock times ('2026-11-10T05:00'). */
export interface PointForecast extends Point {
  time: string[]
  temp: (number | null)[]
  rain: (number | null)[]
  code: (number | null)[]
  wind: (number | null)[]
  gust: (number | null)[]
  isDay: (number | null)[]
}

export interface EventWeather { day: string; points: PointForecast[] }

export interface WeatherHour { kind: WeatherKind | null; tempC: number; windKmh: number | null; gustKmh: number | null; rain: number | null }

const addDays = (day: string, days: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The days to ask for (the event day and the morning after, for a late finish), or null when it isn't today or ahead within the forecast. */
export const forecastWindow = (day: string, today: string): { start: string; end: string } | null => {
  const last = addDays(today, FORECAST_DAYS - 1)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || day > last) return null
  const next = addDays(day, 1)
  return { start: day, end: next <= last ? next : day }
}

/** '2026-11-10T05:40': the moment's wall-clock time in the zone, as Open-Meteo writes its hours. */
export const wallClock = (date: Date, timeZone?: string) => {
  const parts: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)) parts[p.type] = p.value
  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, '0')}:${parts.minute}`
}

const asMinutes = (wall: string) => Date.parse(`${wall}:00Z`) / 60_000

/** The index of the hour nearest the wall-clock time; null when none is within an hour. */
export const pickHour = (times: string[], wall: string): number | null => {
  const at = asMinutes(wall)
  if (!Number.isFinite(at)) return null
  let best: number | null = null
  let bestGap = Infinity
  times.forEach((time, i) => {
    const gap = Math.abs(asMinutes(time) - at)
    if (gap < bestGap) { best = i; bestGap = gap }
  })
  return bestGap <= 60 ? best : null
}

const near = (a: Point, b: Point) => Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lng - b.lng) < 0.001

/** Whether the saved forecast covers every place (a changed route asks again). */
export const covers = (weather: EventWeather | null | undefined, points: Point[]) =>
  Boolean(weather) && points.every(p => weather!.points.some(f => near(f, p)))

/** The weather at a place at a moment, from the saved forecast; null when it isn't in it. */
export const weatherAt = (weather: EventWeather | null | undefined, point: Point, at: Date | null | undefined, timeZone?: string): WeatherHour | null => {
  if (!weather || !at) return null
  const forecast = weather.points.find(f => near(f, point))
  if (!forecast) return null
  const i = pickHour(forecast.time, wallClock(at, timeZone))
  if (i === null) return null
  const tempC = forecast.temp[i]
  if (typeof tempC !== 'number') return null
  const num = (list: (number | null)[]) => (typeof list[i] === 'number' ? list[i] : null)
  return { kind: kindOf(forecast.code[i], forecast.gust[i], forecast.isDay[i] !== 0), tempC, windKmh: num(forecast.wind), gustKmh: num(forecast.gust), rain: num(forecast.rain) }
}

/** 48 (°F) or 9 (°C), whole numbers. */
export const tempIn = (c: number, unit: DistanceUnit) => Math.round(unit === 'mi' ? c * 9 / 5 + 32 : c)
/** 6 (mph) or 10 (km/h). */
export const speedIn = (kmh: number, unit: DistanceUnit) => Math.round(unit === 'mi' ? kmh / 1.609344 : kmh)

const uniquePoints = (points: Point[]) => points.reduce<Point[]>((out, p) => (out.some(q => near(q, p)) ? out : [...out, p]), [])

export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'

/** The request for every place at once (coordinates to four places, about 10 m). */
export const forecastUrl = (points: Point[], window: { start: string; end: string }, timeZone?: string) => {
  const params = new URLSearchParams({
    latitude: points.map(p => p.lat.toFixed(4)).join(','),
    longitude: points.map(p => p.lng.toFixed(4)).join(','),
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
    timezone: timeZone ?? 'auto',
    start_date: window.start,
    end_date: window.end
  })
  return `${WEATHER_URL}?${params}`
}

interface OpenMeteoAnswer {
  latitude?: number
  longitude?: number
  hourly?: { time?: string[]; temperature_2m?: (number | null)[]; precipitation_probability?: (number | null)[]; weather_code?: (number | null)[]; wind_speed_10m?: (number | null)[]; wind_gusts_10m?: (number | null)[]; is_day?: (number | null)[] }
}

/** Open-Meteo's answer (one object for one place, a list for several) as each asked-for place's hours. */
export const parseForecast = (body: unknown, points: Point[]): PointForecast[] => {
  const answers = (Array.isArray(body) ? body : [body]) as OpenMeteoAnswer[]
  return points.flatMap((point, i) => {
    const h = answers[i]?.hourly
    if (!h || !Array.isArray(h.time)) return []
    const list = (values: (number | null)[] | undefined) => (Array.isArray(values) ? values : [])
    return [{
      lat: point.lat, lng: point.lng, time: h.time,
      temp: list(h.temperature_2m), rain: list(h.precipitation_probability), code: list(h.weather_code),
      wind: list(h.wind_speed_10m), gust: list(h.wind_gusts_10m), isDay: list(h.is_day)
    }]
  })
}

/** The forecast for the places on the day; null when there's nothing to ask (no places, or the day is past or too far off). */
export const fetchEventWeather = async (points: Point[], day: string, today: string, timeZone?: string): Promise<EventWeather | null> => {
  const places = uniquePoints(points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)))
  const window = forecastWindow(day, today)
  if (!places.length || !window) return null
  const response = await fetch(forecastUrl(places, window, timeZone), { credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  return { day, points: parseForecast(await response.json(), places) }
}
