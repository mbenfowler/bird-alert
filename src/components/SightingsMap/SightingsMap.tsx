import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router'
import 'leaflet/dist/leaflet.css'
import { prefersReducedMotion, stopFractions } from '../../routeDraw'
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
  route?: { path: [number, number][]; stops: { lat: number; lng: number; label: string }[]; start?: { lat: number; lng: number; label: string } | null
    /** A place being considered: a ghost stop on the end, reached by a dashed line. Never re-frames the map. */
    preview?: { lat: number; lng: number; label: string; from: [number, number] } | null
    /** The roads for an edited route are still on their way: keep the line as it was until they come. */
    settling?: boolean } | null
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
  const routeKey = route ? [...(route.start ? [route.start] : []), ...route.stops].map(s => `${s.lat},${s.lng}`).join('|') : ''
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
      map.flyToBounds(L.latLngBounds([...[...(route.start ? [route.start] : []), ...route.stops].map(s => [s.lat, s.lng] as [number, number]), ...route.path]), { padding: [40, 40], maxZoom: 14, duration: 0.6 })
      return
    }
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    map.flyToBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 14, duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus ? `f:${focusKey}` : route && route.stops.length ? `r:${routeKey}` : `p:${places}`])
  useEffect(() => {
    if (highlightKey) map.panInside(highlightKey.split(',').map(Number) as [number, number], { padding: [36, 36] })
  }, [map, highlightKey])
  return null
}

const DRAW_MS = 1500

/**
 * Draws a shown route (or a focused pin's roads) along its path, the markers along it appearing as
 * the line reaches them. It waits for the map's fly-to to settle (Leaflet redraws the paths at the
 * new zoom), hides line and markers meanwhile, then animates each path's dash offset to zero. The
 * dash styles are cleared afterwards so later zooms and the dashed preview leg draw as before.
 * Reduced motion: drawn at once.
 */
const DrawPaths = ({ drawKey, paths, markers, markerDelays = [] }: { drawKey: string; paths: string; markers: string; markerDelays?: number[] }) => {
  const map = useMap()
  const delays = markerDelays.join(',')
  useEffect(() => {
    if (!drawKey || prefersReducedMotion()) return
    const box = map.getContainer().closest('.sightings-map') ?? map.getContainer()
    box.classList.add('is-draw-waiting')
    let started = false
    const timers: number[] = []
    const start = () => {
      if (started) return
      started = true
      map.off('moveend', start)
      box.classList.remove('is-draw-waiting')
      box.classList.add('is-drawing')
      box.setAttribute('data-drawn', drawKey)
      box.querySelectorAll<SVGPathElement>(paths).forEach((path) => {
        const length = path.getTotalLength?.() ?? 0
        if (!length) return
        path.style.transition = 'none'
        path.style.strokeDasharray = `${length} ${length}`
        path.style.strokeDashoffset = String(length)
        void path.getBoundingClientRect()
        path.style.transition = `stroke-dashoffset ${DRAW_MS}ms ease-in-out`
        path.style.strokeDashoffset = '0'
      })
      const list = delays ? delays.split(',').map(Number) : []
      box.querySelectorAll<HTMLElement>(markers).forEach((marker, i) => {
        marker.style.animationDelay = `${Math.round((list[i] ?? 1) * DRAW_MS)}ms`
      })
      timers.push(window.setTimeout(() => {
        box.classList.remove('is-drawing')
        box.querySelectorAll<SVGPathElement>(paths).forEach((path) => {
          path.style.transition = ''
          path.style.strokeDasharray = ''
          path.style.strokeDashoffset = ''
        })
      }, DRAW_MS + 450))
    }
    // The fly-to that frames the route ends in moveend; if the view didn't need to move, go after it would have.
    map.once('moveend', start)
    timers.push(window.setTimeout(start, 750))
    return () => {
      map.off('moveend', start)
      timers.forEach(window.clearTimeout)
      box.classList.remove('is-draw-waiting', 'is-drawing')
    }
  }, [map, drawKey, paths, markers, delays])
  return null
}

type LatLng = [number, number]
type Route = NonNullable<SightingsMapProps['route']>
/** The line last drawn, kept by the map so a route hidden and shown again (or edited) carries on from it. */
type DrawnRoute = { path: LatLng[]; stops: number }

/** How far a path runs, in degrees: enough to say what share of a route a leg is. */
const pathLength = (path: LatLng[]) => path.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0, 0)

/** True when `path` carries on from where `before` ended: a stop added on the end. */
const extends_ = (path: LatLng[], before: LatLng[]) => before.length >= 2 && path.length > before.length &&
  before.slice(0, -1).every((p, i) => Math.abs(p[0] - path[i][0]) < 1e-6 && Math.abs(p[1] - path[i][1]) < 1e-6)

/** Watches whether the map is mid-flight, from before anything else asks it to move. */
const TrackMoves = ({ moving }: { moving: RefObject<boolean> }) => {
  const map = useMap()
  useEffect(() => {
    const on = () => { moving.current = true }
    const off = () => { moving.current = false }
    map.on('movestart', on)
    map.on('moveend', off)
    return () => { map.off('movestart', on); map.off('moveend', off) }
  }, [map, moving])
  return null
}

// The same icon object every render: a new one makes Leaflet swap the marker's element, losing its pop.
const stopIcons = new Map<number, L.DivIcon>()
const stopIcon = (n: number) => {
  if (!stopIcons.has(n)) stopIcons.set(n, L.divIcon({ className: 'map-stop', html: `<span>${n}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }))
  return stopIcons.get(n)!
}
const START_ICON = L.divIcon({ className: 'map-stop map-stop--start', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })

const FIRST_MS = 1500
const RETRACE_MS = 900
const LEG_MS = 700

/**
 * Draws a shown route along its roads, each stop popping up as the line reaches it. It starts only
 * once the map is on screen (on a phone the button that asks for it sits above the map) and has
 * stopped flying to frame the route. Edits redraw gracefully: a stop added on the end keeps the line
 * that was there and runs it on to the new stop; any other change retraces the line, quicker than the
 * first time. While the page is still fetching the roads of an edited route (`settling`) the old line
 * stays as it was, so the straight-line stand-in never flashes up. Reduced motion: drawn at once.
 */
const RouteDraw = ({ route, moving, drawnRef }: { route: Route; moving: RefObject<boolean>; drawnRef: RefObject<DrawnRoute | null> }) => {
  const map = useMap()
  const pathKey = route.path.map(p => p.join(',')).join('|')
  const stopsKey = route.stops.map(s => `${s.lat},${s.lng}`).join('|')
  const settling = Boolean(route.settling)
  useEffect(() => {
    const box = map.getContainer().closest<HTMLElement>('.sightings-map') ?? map.getContainer()
    const before = drawnRef.current
    if (settling) {
      // Nothing drawn yet: keep the stand-in hidden until the roads come. Otherwise the old line stays.
      if (!before) box.classList.add('is-route-waiting')
      return
    }
    if (route.path.length < 2) return
    if (prefersReducedMotion()) {
      box.classList.remove('is-route-waiting')
      drawnRef.current = { path: route.path, stops: route.stops.length }
      box.setAttribute('data-drawn', 'route')
      return
    }
    const mode = !before ? 'first' : extends_(route.path, before.path) ? 'extend' : 'retrace'
    const total = pathLength(route.path) || 1
    const from = mode === 'extend' ? Math.min(1, pathLength(before!.path) / total) : 0
    const ms = mode === 'first' ? FIRST_MS : mode === 'extend' ? LEG_MS : RETRACE_MS
    const firstNew = mode === 'extend' ? before!.stops : 0
    const fractions = stopFractions(route.path, route.stops)
    const lines = () => [...box.querySelectorAll<SVGPathElement>('path.map-route:not(.map-route--preview)')]
    const stopEls = () => [...box.querySelectorAll<HTMLElement>('.map-stop:not(.map-stop--preview):not(.map-stop--start)')]
    // Hold the line at what's already been drawn, and the new stops back, until it can run.
    const hold = () => {
      // An edit made while the last draw was still running: its pops end here.
      box.querySelectorAll<HTMLElement>('.map-stop.is-popping').forEach((el) => { el.classList.remove('is-popping'); el.style.animationDelay = '' })
      lines().forEach((line) => {
        const length = line.getTotalLength?.() ?? 0
        if (!length) return
        line.style.transition = 'none'
        line.style.strokeDasharray = `${length} ${length}`
        line.style.strokeDashoffset = String(length * (1 - from))
      })
      stopEls().forEach((el, i) => { if (i >= firstNew) el.classList.add('is-waiting') })
      if (mode === 'first') box.querySelector('.map-stop--start')?.classList.add('is-waiting')
    }
    hold()
    box.classList.remove('is-route-waiting')
    const timers: number[] = []
    let visible = false
    let started = false
    const run = () => {
      if (started || !visible || moving.current) return
      started = true
      map.off('moveend', run)
      // The fly-to redrew the line at the new zoom: measure again.
      hold()
      lines().forEach((line) => {
        void line.getBoundingClientRect()
        line.style.transition = `stroke-dashoffset ${ms}ms ease-in-out`
        line.style.strokeDashoffset = '0'
      })
      const pop = (el: Element | null | undefined, at: number) => {
        if (!el) return
        const node = el as HTMLElement
        node.style.animationDelay = `${Math.round(Math.max(0, at) * ms)}ms`
        node.classList.remove('is-waiting')
        node.classList.add('is-popping')
      }
      if (mode === 'first') pop(box.querySelector('.map-stop--start'), 0)
      stopEls().forEach((el, i) => { if (i >= firstNew) pop(el, ((fractions[i] ?? 1) - from) / (1 - from || 1)) })
      box.setAttribute('data-drawn', mode)
      drawnRef.current = { path: route.path, stops: route.stops.length }
      timers.push(window.setTimeout(() => {
        lines().forEach((line) => { line.style.transition = ''; line.style.strokeDasharray = ''; line.style.strokeDashoffset = '' })
        box.querySelectorAll<HTMLElement>('.is-popping').forEach((el) => { el.classList.remove('is-popping'); el.style.animationDelay = '' })
      }, ms + 450))
    }
    map.on('moveend', run)
    const seen = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= 0.5; run() }, { threshold: [0, 0.5, 1] })
    seen.observe(box)
    return () => {
      seen.disconnect()
      map.off('moveend', run)
      timers.forEach(window.clearTimeout)
      if (!started) {
        // Cut off before it ran: show it all rather than leave it half held.
        lines().forEach((line) => { line.style.transition = ''; line.style.strokeDasharray = ''; line.style.strokeDashoffset = '' })
        box.querySelectorAll('.map-stop.is-waiting').forEach((el) => el.classList.remove('is-waiting'))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pathKey, stopsKey, settling])
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
  const moving = useRef(false)
  const drawn = useRef<DrawnRoute | null>(null)
  return (
    <div className={`sightings-map ${focus ? 'is-focused' : ''} ${route ? 'has-route' : ''}`} style={{ height }} role='region' aria-label={ariaLabel}>
      <MapContainer center={initial} zoom={points.length ? 12 : 4} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
        />
        <TrackMoves moving={moving} />
        <FitToPoints points={points} focus={focus} route={route} />
        {focus && <DrawPaths drawKey={`focus:${focus.origin.lat},${focus.origin.lng}|${focus.targets.map(t => t.id).join('|')}`} paths='path.map-road' markers='.map-pin--public' />}
        {route && (
          <>
            <Polyline className='map-route map-route--casing' positions={route.path} pathOptions={{ color: '#fff', weight: 8, opacity: 0.9 }} />
            <Polyline className='map-route' positions={route.path} pathOptions={{ color: '#1a56db', weight: 4, opacity: 0.95 }} />
            {route.start && (
              <Marker position={[route.start.lat, route.start.lng]} icon={START_ICON} zIndexOffset={1900}>
                <Tooltip direction='top' offset={[0, -12]}>{route.start.label}</Tooltip>
              </Marker>
            )}
            {route.preview && (
              <>
                <Polyline key={`preview-${route.preview.lat},${route.preview.lng}`} className='map-route map-route--preview' positions={[route.preview.from, [route.preview.lat, route.preview.lng]]} pathOptions={{ color: '#1a56db', weight: 4, opacity: 0.8, dashArray: '2 8', lineCap: 'round' }} />
                <Marker position={[route.preview.lat, route.preview.lng]} icon={L.divIcon({ className: 'map-stop map-stop--preview', html: `<span>${route.stops.length + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] })} zIndexOffset={2100} interactive={false} />
              </>
            )}
            {route.stops.map((stop, i) => (
              <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon(i + 1)} zIndexOffset={2000}>
                <Tooltip direction='top' offset={[0, -14]}>{stop.label}</Tooltip>
              </Marker>
            ))}
            {route.stops.length > 0 && <RouteDraw route={route} moving={moving} drawnRef={drawn} />}
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
