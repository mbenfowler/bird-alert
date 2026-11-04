/**
 * "Download the area in your maps app": neither Google Maps nor Apple Maps has a link that starts
 * an offline download, so the button opens the maps app on the day's area, framed to fit the route.
 * Both apps then start their offline-map box on what's on screen, and saving is a couple of taps.
 */

export interface LatLng { lat: number; lng: number }
export interface Box { south: number; west: number; north: number; east: number }
export interface MapArea { center: LatLng; zoom: number; box: Box }
export type MapsApp = 'google' | 'apple'
export type Platform = 'ios' | 'android' | 'desktop'

/** Wide enough for the whole day's driving, close enough that the offline box isn't a whole state. */
export const MIN_ZOOM = 8
export const MAX_ZOOM = 12
/** Around a route's stops, so the edge ones aren't on the edge of the map. */
const STOP_MARGIN_KM = 3
/** Around the event's centre when there's no route yet: its range, or this. */
const DEFAULT_RANGE_MI = 15
/** A phone's map, in CSS pixels, under the app's own search bar and sheet. */
const VIEW = { width: 360, height: 560 }
const TILE = 256
const KM_PER_DEG_LAT = 111.32
const KM_PER_MI = 1.609344

const valid = (p: Partial<LatLng> | null | undefined): p is LatLng =>
  Boolean(p) && Number.isFinite(p!.lat) && Number.isFinite(p!.lng) && Math.abs(p!.lat!) <= 90 && Math.abs(p!.lng!) <= 180

/** The smallest box holding every point; null with none. */
export const boundsOf = (points: (Partial<LatLng> | null | undefined)[]): Box | null => {
  const ok = points.filter(valid)
  if (!ok.length) return null
  return {
    south: Math.min(...ok.map(p => p.lat)), north: Math.max(...ok.map(p => p.lat)),
    west: Math.min(...ok.map(p => p.lng)), east: Math.max(...ok.map(p => p.lng))
  }
}

/** The box grown by `km` on every side. */
export const padBox = (box: Box, km: number): Box => {
  const dLat = km / KM_PER_DEG_LAT
  const mid = (box.south + box.north) / 2
  const dLng = km / (KM_PER_DEG_LAT * Math.max(Math.cos(mid * Math.PI / 180), 0.01))
  return { south: Math.max(box.south - dLat, -85), north: Math.min(box.north + dLat, 85), west: box.west - dLng, east: box.east + dLng }
}

export const centreOf = (box: Box): LatLng => ({ lat: (box.south + box.north) / 2, lng: (box.west + box.east) / 2 })

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(Math.min(lat, 85), -85) * Math.PI) / 360))

/** The closest whole zoom (web map tiles, as both apps use) that shows the whole box on a phone. */
export const fitZoom = (box: Box, view = VIEW) => {
  const lngFraction = (box.east - box.west) / 360
  const latFraction = (mercatorY(box.north) - mercatorY(box.south)) / (2 * Math.PI)
  const fit = (px: number, fraction: number) => (fraction > 0 ? Math.log2(px / TILE / fraction) : Infinity)
  return Math.floor(Math.min(fit(view.width, lngFraction), fit(view.height, latFraction)))
}

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? zoom : MAX_ZOOM))

/**
 * The day's area: the route's stops and the meeting point when there are any, else the event's
 * centre and its range. Null when the event has neither (the links then search by the area's name).
 */
export const mapArea = ({ start, stops = [], home, rangeMi }: {
  start?: Partial<LatLng> | null
  stops?: Partial<LatLng>[]
  home?: { lat?: number | null; lng?: number | null } | null
  rangeMi?: number | null
}): MapArea | null => {
  const route = boundsOf([start, ...stops])
  const centre = home && valid({ lat: home.lat ?? undefined, lng: home.lng ?? undefined }) ? { lat: home.lat!, lng: home.lng! } : null
  const box = route
    ? padBox(route, STOP_MARGIN_KM)
    : centre ? padBox(boundsOf([centre])!, (rangeMi && rangeMi > 0 ? rangeMi : DEFAULT_RANGE_MI) * KM_PER_MI) : null
  if (!box) return null
  return { center: centreOf(box), zoom: clampZoom(fitZoom(box)), box }
}

const coord = (n: number) => String(Number(n.toFixed(5)))

/** Google's Maps URLs API: opens the app on Android and iOS when it's there, else the web. */
export const googleMapUrl = (area: MapArea | null, name = '') => area
  ? `https://www.google.com/maps/@?api=1&map_action=map&center=${coord(area.center.lat)},${coord(area.center.lng)}&zoom=${area.zoom}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`

/** Apple Maps: `ll` (the centre) with `z` (the zoom), as in Apple's Map Links parameters. */
export const appleMapUrl = (area: MapArea | null, name = '') => area
  ? `https://maps.apple.com/?ll=${coord(area.center.lat)},${coord(area.center.lng)}&z=${area.zoom}`
  : `https://maps.apple.com/?q=${encodeURIComponent(name)}`

export const mapUrl = (app: MapsApp, area: MapArea | null, name = '') => (app === 'apple' ? appleMapUrl : googleMapUrl)(area, name)

/** iPhone and iPad (iPadOS asks for desktop pages as a Mac, but a Mac has no touch screen), Android, or neither. */
export const platformOf = (userAgent: string, maxTouchPoints = 0): Platform => {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'desktop'
}

export const currentPlatform = (): Platform =>
  typeof navigator === 'undefined' ? 'desktop' : platformOf(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0)

const APP_KEY = 'bird-alert:maps-app'

/** The maps app this person picked last, on this device. */
export const savedMapsApp = (): MapsApp | null => {
  try { const app = localStorage.getItem(APP_KEY); return app === 'google' || app === 'apple' ? app : null } catch { return null }
}
export const saveMapsApp = (app: MapsApp) => { try { localStorage.setItem(APP_KEY, app) } catch { /* lasts the visit */ } }

/** Android has no Apple Maps; an iPhone starts on Apple's; a computer on Google's. A choice made here wins. */
export const defaultMapsApp = (platform: Platform, saved: MapsApp | null): MapsApp =>
  platform === 'android' ? 'google' : saved ?? (platform === 'ios' ? 'apple' : 'google')

const mapSavedKey = (id: string | number) => `bird-alert:event-map-saved:${id}`

/** "I've downloaded the map", ticked on this device for this event. */
export const mapDownloaded = (id: string | number) => {
  try { return localStorage.getItem(mapSavedKey(id)) === '1' } catch { return false }
}
export const setMapDownloaded = (id: string | number, done: boolean) => {
  try { if (done) localStorage.setItem(mapSavedKey(id), '1'); else localStorage.removeItem(mapSavedKey(id)) } catch { /* lasts the visit */ }
}
