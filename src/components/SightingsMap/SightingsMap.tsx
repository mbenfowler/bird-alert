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

// Pins are drawn with CSS so no image assets have to be resolved by the bundler.
const pinIcon = (highlight: boolean) => L.divIcon({
  className: `map-pin ${highlight ? 'map-pin--highlight' : ''}`,
  html: '<span class="map-pin__head"></span><span class="map-pin__tail"></span>',
  iconSize: [26, 36],
  iconAnchor: [13, 36],
  popupAnchor: [0, -32]
})

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
  const ordered = useMemo(() => [...points].sort((a, b) => Number(a.highlight) - Number(b.highlight)), [points])
  return (
    <div className='sightings-map' style={{ height }} role='region' aria-label={ariaLabel}>
      <MapContainer center={initial} zoom={points.length ? 12 : 4} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <FitToPoints points={points} />
        {ordered.map(point => (
          <Marker key={point.id} position={[point.lat, point.lng]} icon={pinIcon(Boolean(point.highlight))} zIndexOffset={point.highlight ? 1000 : 0} title={point.subtitle ? `${point.title}, ${point.subtitle}` : point.title} alt={point.title}>
            <Popup>
              <strong>{point.title}</strong>
              {point.subtitle && <><br />{point.subtitle}</>}
              {point.href && <><br /><Link to={point.href}>Details</Link></>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default SightingsMap
