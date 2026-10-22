import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
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

interface SightingsMapProps {
  points: MapPoint[]
  /** Fallback centre when there are no points. */
  center?: [number, number]
  height?: number | string
  ariaLabel: string
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

const FitToPoints = ({ points }: { points: MapPoint[] }) => {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const highlighted = points.find(p => p.highlight)
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
    if (highlighted) map.panInside([highlighted.lat, highlighted.lng], { padding: [36, 36] })
  }, [map, points])
  return null
}

/** OpenStreetMap with a pin per sighting; the highlighted pin is the one being looked at. */
const SightingsMap = ({ points, center = [39.8, -98.6], height = 360, ariaLabel }: SightingsMapProps) => {
  const initial = useMemo<[number, number]>(() => (points[0] ? [points[0].lat, points[0].lng] : center), [points, center])
  const groups = useMemo(() => groupByPlace(points).sort((a, b) => Number(a.highlight) - Number(b.highlight)), [points])
  return (
    <div className='sightings-map' style={{ height }} role='region' aria-label={ariaLabel}>
      <MapContainer center={initial} zoom={points.length ? 12 : 4} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <FitToPoints points={points} />
        {groups.map(group => (
          <Marker key={group.id} position={[group.lat, group.lng]} icon={pinIcon(group.highlight, group.points.length)} zIndexOffset={group.highlight ? 1000 : 0}
            title={group.points.map(p => (p.subtitle ? `${p.title}, ${p.subtitle}` : p.title)).join('; ')} alt={group.points.map(p => p.title).join(', ')}>
            <Popup>
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
