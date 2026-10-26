import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router'
import 'leaflet/dist/leaflet.css'
import './SightingsMap.css'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
  /** In-app link for the popup. */
  href?: string
  highlight?: boolean
}

/** A public place reachable from a focused pin, with the road to it when known. */
export interface FocusTarget { id: string; n: number; lat: number; lng: number; label: string; detail?: string; kind: 'hotspot' | 'park'; path?: [number, number][] | null; minutes?: number | null }
export interface MapFocus {
  origin: { lat: number; lng: number; label: string }
  targets: FocusTarget[]
  /** The one public land being looked at: its road and pin light up, the others step back. */
  activeId?: string | null
  onTargetClick?: (id: string) => void
}

interface SightingsMapProps {
  points: MapPoint[]
  /** When set, the map zooms to this pin and its public lands, dims every other pin, and draws the roads. */
  focus?: MapFocus | null
  /** A route through stops, drawn as one line when the page asks for it. */
  route?: { path: [number, number][]; stops: { lat: number; lng: number; label: string }[] } | null
  /** Fallback centre when there are no points. */
  center?: [number, number]
  height?: number | string
  ariaLabel: string
  /** Called with every point under a tapped pin, so the page can highlight what it stands for. */
  onPinClick?: (points: MapPoint[]) => void
  /** Open the highlighted pin's popup whenever the highlight moves (a page that selects from a list). */
  openHighlighted?: boolean
}

// Pins are drawn with CSS so no image assets have to be resolved by the bundler. Several sightings
// at one spot (one checklist, several species) share a pin that shows how many.
const pinIcon = (highlight: boolean, count: number) => L.divIcon({
  className: `map-pin ${highlight ? 'map-pin--highlight' : ''}`,
  html: `<span class="map-pin__head">${count > 1 ? `<span class="map-pin__count">${count}</span>` : ''}</span><span class="map-pin__tail"></span>`,
  iconSize: [26, 36],
  iconAnchor: [13, 36],
  popupAnchor: [0, -32]
})

interface PinGroup { id: string; lat: number; lng: number; points: MapPoint[]; highlight: boolean }

/** Points at identical coordinates become one pin, so none hides behind another. */
const groupByPlace = (points: MapPoint[]): PinGroup[] => {
  const groups = new Map<string, PinGroup>()
  for (const point of points) {
    const key = `${point.lat},${point.lng}`
    const group = groups.get(key) ?? { id: key, lat: point.lat, lng: point.lng, points: [], highlight: false }
    group.points.push(point)
    group.highlight = group.highlight || Boolean(point.highlight)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Frames the pins once per set of places; a change of highlight only pans, it never re-zooms. */
const FitToPoints = ({ points, focus, route }: { points: MapPoint[]; focus?: MapFocus | null; route?: SightingsMapProps['route'] }) => {
  const map = useMap()
  const places = points.map(p => `${p.lat},${p.lng}`).join('|')
  const highlighted = points.find(p => p.highlight)
  const highlightKey = highlighted ? `${highlighted.lat},${highlighted.lng}` : ''
  const focusKey = focus ? `${focus.origin.lat},${focus.origin.lng}|${focus.targets.map(t => `${t.lat},${t.lng}`).join('|')}` : ''
  const routeKey = route ? route.stops.map(s => `${s.lat},${s.lng}`).join('|') : ''
  useEffect(() => {
    // A focus frames the pin and its public lands (roads included); a shown route frames its stops;
    // otherwise the pins. Clearing a focus or route falls back through the same effect.
    if (focus) {
      // A popup left open from before (the selected report) would sit over the roads.
      map.closePopup()
      const pts: [number, number][] = [[focus.origin.lat, focus.origin.lng], ...focus.targets.map(t => [t.lat, t.lng] as [number, number]), ...focus.targets.flatMap(t => t.path ?? [])]
      map.flyToBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14, duration: 0.6 })
      return
    }
    if (route && route.stops.length) {
      map.flyToBounds(L.latLngBounds([...route.stops.map(s => [s.lat, s.lng] as [number, number]), ...route.path]), { padding: [40, 40], maxZoom: 14, duration: 0.6 })
      return
    }
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    map.flyToBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 14, duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places, focusKey, routeKey])
  useEffect(() => {
    if (highlightKey) map.panInside(highlightKey.split(',').map(Number) as [number, number], { padding: [36, 36] })
  }, [map, highlightKey])
  return null
}

/** Opens the highlighted pin's popup once the map has stopped moving, so its auto-pan starts from the settled view. */
const OpenHighlighted = ({ id, markers }: { id: string; markers: RefObject<Map<string, L.Marker>> }) => {
  const map = useMap()
  useEffect(() => {
    if (!id) return
    let done = false
    const open = () => {
      if (done) return
      done = true
      map.off('moveend', open)
      markers.current?.get(id)?.openPopup()
    }
    // A fit or pan started in the same render ends with moveend; if none was started, go after a beat.
    map.once('moveend', open)
    const timer = window.setTimeout(open, 320)
    return () => { done = true; map.off('moveend', open); window.clearTimeout(timer) }
  }, [map, id, markers])
  return null
}

/** OpenStreetMap with a pin per sighting; the highlighted pin is the one being looked at. */
/** A public land's pin: numbered to match its entry in the list, so the map needs no labels. */
const publicIcon = (kind: 'hotspot' | 'park', n: number, active: boolean) => L.divIcon({
  className: `map-pin map-pin--public map-pin--${kind} ${active ? 'map-pin--active' : ''}`,
  html: `<span class="map-pin__head"><span class="map-pin__count">${n}</span></span><span class="map-pin__tail"></span>`,
  iconSize: [26, 36],
  iconAnchor: [13, 36],
  popupAnchor: [0, -32]
})

/**
 * Map tiles. OpenStreetMap's own servers are for light use only; before real traffic, point
 * VITE_TILE_URL (and VITE_TILE_ATTRIBUTION) at a provider with a key, e.g. MapTiler or Stadia,
 * at build time. No code change needed.
 */
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** A straight line between two points, for when the road could not be had. */
const straight = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): [number, number][] => [[a.lat, a.lng], [b.lat, b.lng]]

const SightingsMap = ({ points, focus = null, route = null, center = [39.8, -98.6], height = 360, ariaLabel, onPinClick, openHighlighted = false }: SightingsMapProps) => {
  const initial = useMemo<[number, number]>(() => (points[0] ? [points[0].lat, points[0].lng] : center), [points, center])
  const groups = useMemo(() => groupByPlace(points).sort((a, b) => Number(a.highlight) - Number(b.highlight)), [points])
  const markers = useRef(new Map<string, L.Marker>())
  const highlightedId = groups.find(g => g.highlight)?.id ?? ''
  return (
    <div className={`sightings-map ${focus ? 'is-focused' : ''} ${route ? 'has-route' : ''}`} style={{ height }} role='region' aria-label={ariaLabel}>
      <MapContainer center={initial} zoom={points.length ? 12 : 4} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
        />
        <FitToPoints points={points} focus={focus} route={route} />
        {route && (
          <>
            <Polyline className='map-route map-route--casing' positions={route.path} pathOptions={{ color: '#fff', weight: 8, opacity: 0.9 }} />
            <Polyline className='map-route' positions={route.path} pathOptions={{ color: '#1a56db', weight: 4, opacity: 0.95 }} />
            {route.stops.map((stop, i) => (
              <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={L.divIcon({ className: 'map-stop', html: `<span>${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] })} zIndexOffset={2000}>
                <Tooltip direction='top' offset={[0, -14]}>{stop.label}</Tooltip>
              </Marker>
            ))}
          </>
        )}
        {focus && focus.targets.map(t => {
          const path = t.path && t.path.length > 1 ? t.path : straight(focus.origin, t)
          const byRoad = Boolean(t.path && t.path.length > 1)
          const active = focus.activeId === t.id
          const stepBack = Boolean(focus.activeId) && !active
          const base = t.kind === 'park' ? '#6b5800' : '#0f7b3a'
          return (
            <span key={t.id}>
              {/* Keyed on the state: Leaflet applies a path's class only when it is created. */}
              <Polyline key={`casing-${active}-${stepBack}`} className={`map-road map-road--casing ${active ? 'is-active' : ''}`} positions={path} pathOptions={{ color: active ? '#111' : '#fff', weight: active ? 10 : 7, opacity: stepBack ? 0.3 : 0.85 }} />
              <Polyline key={`road-${active}-${stepBack}`} className={`map-road ${byRoad ? '' : 'map-road--straight'} ${active ? 'is-active' : ''}`} positions={path}
                pathOptions={{ color: active ? '#ffd700' : base, weight: active ? 6 : 4, opacity: stepBack ? 0.35 : 0.95, dashArray: byRoad ? undefined : '6 8' }}
                eventHandlers={focus.onTargetClick ? { click: () => focus.onTargetClick!(t.id) } : undefined} />
              {/* Quiet by default: the name and the drive appear when this pin is tapped; the tap also lights its road. */}
              <Marker position={[t.lat, t.lng]} icon={publicIcon(t.kind, t.n, active)} zIndexOffset={active ? 1800 : 1500} title={t.label}
                opacity={stepBack ? 0.55 : 1}
                eventHandlers={focus.onTargetClick ? { click: () => focus.onTargetClick!(t.id) } : undefined}>
                <Popup><strong>{t.n}. {t.label}</strong>{t.detail && <><br />{t.detail}</>}</Popup>
              </Marker>
            </span>
          )
        })}
        {openHighlighted && <OpenHighlighted id={highlightedId} markers={markers} />}
        {groups.map(group => (
          <Marker key={group.id} position={[group.lat, group.lng]} icon={pinIcon(group.highlight, group.points.length)} zIndexOffset={group.highlight ? 1000 : 0}
            ref={(marker) => { if (marker) markers.current.set(group.id, marker); else markers.current.delete(group.id) }}
            eventHandlers={onPinClick ? { click: () => onPinClick(group.points) } : undefined}
            title={group.points.map(p => (p.subtitle ? `${p.title}, ${p.subtitle}` : p.title)).join('; ')} alt={group.points.map(p => p.title).join(', ')}>
            {/* A pin with many reports gets a popup that scrolls rather than one taller than the map. */}
            <Popup maxHeight={220}>
              {group.points.map((point, index) => (
                <div key={point.id} className={index ? 'map-popup__item' : undefined}>
                  <strong>{point.title}</strong>
                  {point.subtitle && <><br />{point.subtitle}</>}
                  {point.href && <><br /><Link to={point.href}>Details</Link></>}
                </div>
              ))}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default SightingsMap
