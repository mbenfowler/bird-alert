import { useState } from 'react'
import { LoadingState } from '../Loading/Loading'
import { useNearbyPublicQuery } from '../../hooks/queries'
import type { NearbyHotspot, NearbyPark } from '../../types'
import './NearbyPublic.css'

const mapsHref = (lat: number, lng: number, name: string) => {
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
  return apple ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}&z=15` : `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`
}

const lastBirded = (iso: string | null) => {
  if (!iso) return 'never birded'
  const d = new Date(`${iso}T12:00:00`)
  return `last birded ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

interface NearbyPublicProps { lat: number | null; lng: number | null; placeName: string }

/**
 * For a private place: the public land around it. eBird's hotspots nearby, with how much each has
 * been birded (little effort is a sneaky pick), and parks eBird does not list. Fetched on request.
 */
const NearbyPublic = ({ lat, lng, placeName }: NearbyPublicProps) => {
  const [open, setOpen] = useState(false)
  const nearby = useNearbyPublicQuery(lat, lng, open)
  if (lat === null || lng === null) return null

  const hotspots: NearbyHotspot[] = nearby.data?.hotspots ?? []
  const parks: NearbyPark[] = nearby.data?.parks ?? []

  return (
    <div className='nearby'>
      {!open
        ? <button type='button' className='nearby__ask' onClick={() => setOpen(true)}>Public land nearby</button>
        : nearby.isPending ? <LoadingState variant='inline' label='Looking for public land nearby' />
        : nearby.isError ? <p className='nearby__note'>Could not look up public land near {placeName} right now.</p>
        : !hotspots.length && !parks.length ? <p className='nearby__note'>No public land within a few miles of {placeName} is on file.</p>
        : (
          <ul className='nearby__list' aria-label={`Public land near ${placeName}`}>
            {hotspots.map(h => (
              <li key={h.locId}>
                <a href={mapsHref(h.lat, h.lng, h.name)} target='_blank' rel='noreferrer'>
                  <strong>{h.name.replace(/^Lake Lanier--/, '')}</strong>
                  <span>{h.miles} mi · {h.checklists ?? 0} {h.checklists === 1 ? 'checklist' : 'checklists'} all time{h.species ? `, ${h.species} species` : ''} · {lastBirded(h.latest)}</span>
                  {h.lightlyBirded && <em>lightly birded, a sneaky pick</em>}
                </a>
              </li>
            ))}
            {parks.map(p => (
              <li key={`${p.name}-${p.lat}`}>
                <a href={mapsHref(p.lat, p.lng, p.name)} target='_blank' rel='noreferrer'>
                  <strong>{p.name}</strong>
                  <span>{p.miles} mi · not an eBird hotspot</span>
                  <em>unlisted, nobody is counting here</em>
                </a>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

export default NearbyPublic
