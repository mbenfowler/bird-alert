import { CompassIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import type { NearbyPublic as NearbyData, NearbyHotspot, NearbyPark } from '../../types'
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

/** "9 min drive · 4.8 mi", or the straight-line distance when the road could not be had. */
const reach = (t: { miles: number; drive?: { minutes: number; miles: number } | null }) =>
  t.drive ? `${t.drive.minutes} min drive · ${t.drive.miles} mi` : `${t.miles} mi as the crow flies`

interface NearbyPublicProps {
  placeName: string
  open: boolean
  onOpen: () => void
  data: NearbyData | undefined
  isPending: boolean
  isError: boolean
  /** The entry being looked at, lit on the map too; the number button picks it. */
  activeId?: string | null
  onPick?: (id: string) => void
  /** Ends the look-around: the map goes back to all the pins. */
  onClose: () => void
}

/**
 * For a private place: the public land around it. eBird's hotspots nearby, with how much each has
 * been birded (little effort is a sneaky pick), parks eBird does not list, and the drive to each.
 * The page owns the open state so it can focus the map on the same places.
 */
const NearbyPublic = ({ placeName, open, onOpen, data, isPending, isError, activeId = null, onPick, onClose }: NearbyPublicProps) => {
  if (!open) {
    return (
      <div className='nearby'>
        <button type='button' className='nearby__ask' onClick={onOpen}><CompassIcon /> Public land nearby</button>
      </div>
    )
  }
  const hotspots: NearbyHotspot[] = data?.hotspots ?? []
  const parks: NearbyPark[] = data?.parks ?? []
  return (
    <div className='nearby is-open'>
      <div className='nearby__head'>
        <strong>Public land near {placeName}</strong>
        <button type='button' className='nearby__close' onClick={onClose}>Back to all pins</button>
      </div>
      {isPending ? <LoadingState variant='inline' label='Looking for public land nearby' />
        : isError ? <p className='nearby__note'>Could not look up public land near {placeName} right now.</p>
        : !hotspots.length && !parks.length ? <p className='nearby__note'>No public land within a few miles of {placeName} is on file.</p>
        : (
          <ul className='nearby__list' aria-label={`Public land near ${placeName}`}>
            {hotspots.map((h, i) => (
              <li key={h.locId} className={`nearby__hotspot ${activeId === h.locId ? 'is-active' : ''}`}>
                <button type='button' className='nearby__n' aria-pressed={activeId === h.locId} aria-label={`Show the road to ${h.name} on the map`} onClick={() => onPick?.(h.locId)}>{i + 1}</button>
                <a href={mapsHref(h.lat, h.lng, h.name)} target='_blank' rel='noreferrer'>
                  <strong>{h.name.replace(/^Lake Lanier--/, '')}</strong>
                  <span className='nearby__reach'>{reach(h)}</span>
                  <span>{h.checklists ?? 0} {h.checklists === 1 ? 'checklist' : 'checklists'} all time{h.species ? `, ${h.species} species` : ''} · {lastBirded(h.latest)}</span>
                  {h.lightlyBirded && <em>lightly birded, a sneaky pick</em>}
                </a>
              </li>
            ))}
            {parks.map((p, i) => (
              <li key={`${p.name}-${p.lat}`} className={`nearby__park ${activeId === `${p.name}-${p.lat}` ? 'is-active' : ''}`}>
                <button type='button' className='nearby__n' aria-pressed={activeId === `${p.name}-${p.lat}`} aria-label={`Show the road to ${p.name} on the map`} onClick={() => onPick?.(`${p.name}-${p.lat}`)}>{hotspots.length + i + 1}</button>
                <a href={mapsHref(p.lat, p.lng, p.name)} target='_blank' rel='noreferrer'>
                  <strong>{p.name}</strong>
                  <span className='nearby__reach'>{reach(p)}</span>
                  <span>not an eBird hotspot</span>
                  <em>unlisted, nobody is counting here</em>
                </a>
              </li>
            ))}
          </ul>
        )}
      <p className='nearby__hint'>The numbers match the pins on the map; tap a number or a pin to light up that road. Tapping any other place's pin goes back to all the pins.</p>
    </div>
  )
}

export default NearbyPublic
