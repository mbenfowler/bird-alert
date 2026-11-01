import type { PointerEvent as ReactPointerEvent } from 'react'
import { CompassIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import type { NearbyPublic as NearbyData, NearbyHotspot, NearbyPark } from '../../types'
import type { PlanPoint } from '../../routePlan'
import { shortDistance, unitWord, useDistanceUnit, type DistanceUnit } from '../../distance'
import './NearbyPublic.css'
import { monthYear, t } from '../../i18n'

const mapsHref = (lat: number, lng: number, name: string) => {
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
  return apple ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}&z=15` : `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`
}

const lastBirded = (iso: string | null) => {
  if (!iso) return t('nearby.never')
  return t('nearby.lastBirded', { when: monthYear(iso) })
}

/** "9 min drive · 4.8 mi", or the straight-line distance when the road could not be had. */
const reach = (target: { miles: number; drive?: { minutes: number; miles: number } | null }, unit: DistanceUnit) =>
  target.drive ? t('nearby.drive', { minutes: target.drive.minutes, distance: shortDistance(target.drive.miles, unit) }) : t('nearby.crow', { distance: shortDistance(target.miles, unit) })

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
  /** Where a route is being planned: whether a place is on it, putting it on or off, and a look at it on the route while the mouse rests on it. */
  route?: {
    has: (point: PlanPoint) => boolean
    toggle: (point: PlanPoint) => void
    preview: (point: PlanPoint | null) => void
    full: boolean
  }
}

/**
 * For a private place: the public land around it. eBird's hotspots nearby, with how much each has
 * been birded (little effort is a sneaky pick), parks eBird does not list, and the drive to each.
 * The page owns the open state so it can focus the map on the same places.
 */
const NearbyPublic = ({ placeName, open, onOpen, data, isPending, isError, activeId = null, onPick, onClose, route }: NearbyPublicProps) => {
  const unit = useDistanceUnit()
  if (!open) {
    return (
      <div className='nearby'>
        <button type='button' className='nearby__ask' onClick={onOpen}><CompassIcon /> {t('nearby.ask')}</button>
      </div>
    )
  }
  // Each entry can go on the route; resting the mouse on one shows it on the end of the route meanwhile.
  const routeBits = (point: PlanPoint) => {
    if (!route) return { hover: {}, button: null }
    const on = route.has(point)
    return {
      hover: {
        onPointerEnter: (e: ReactPointerEvent) => { if (e.pointerType === 'mouse' && !on) route.preview(point) },
        onPointerLeave: () => route.preview(null)
      },
      button: (
        <button type='button' className={`nearby__route ${on ? 'is-on' : ''}`} aria-pressed={on} disabled={!on && route.full}
          aria-label={on ? t('nearby.offRoute', { name: point.name }) : t('nearby.onRoute', { name: point.name })}
          onClick={() => { route.preview(null); route.toggle(point) }}>
          {on ? '✓' : '+'}<span>{t('nearby.route')}</span>
        </button>
      )
    }
  }
  const note = t('nearby.near', { placeName })
  const hotspots: NearbyHotspot[] = data?.hotspots ?? []
  const parks: NearbyPark[] = data?.parks ?? []
  return (
    <div className='nearby is-open'>
      <div className='nearby__head'>
        <strong>{note}</strong>
        <button type='button' className='nearby__close' onClick={onClose}>{t('nearby.back')}</button>
      </div>
      {isPending ? <LoadingState variant='inline' label={t('nearby.looking')} />
        : isError ? <p className='nearby__note'>{t('nearby.failed', { placeName })}</p>
        : !hotspots.length && !parks.length ? <p className='nearby__note'>{t('nearby.none', { units: unitWord(unit), placeName })}</p>
        : (
          <ul className='nearby__list' aria-label={note}>
            {hotspots.map((h, i) => {
              const bits = routeBits({ locId: h.locId, name: h.name, lat: h.lat, lng: h.lng, note })
              return (
              <li key={h.locId} className={`nearby__hotspot ${activeId === h.locId ? 'is-active' : ''}`} {...bits.hover}>
                <button type='button' className='nearby__n' aria-pressed={activeId === h.locId} aria-label={t('nearby.showRoad', { name: h.name })} onClick={() => onPick?.(h.locId)}>{i + 1}</button>
                <a href={mapsHref(h.lat, h.lng, h.name)} target='_blank' rel='noreferrer'>
                  <strong>{h.name.replace(/^Lake Lanier--/, '')}</strong>
                  <span className='nearby__reach'>{reach(h, unit)}</span>
                  <span>{h.species ? t('nearby.effortSpecies', { count: h.checklists ?? 0, species: h.species }) : t('nearby.effort', { count: h.checklists ?? 0 })} · {lastBirded(h.latest)}</span>
                  {h.lightlyBirded && <em>{t('nearby.sneaky')}</em>}
                </a>
                {bits.button}
              </li>
              )
            })}
            {parks.map((p, i) => {
              const bits = routeBits({ locId: null, name: p.name, lat: p.lat, lng: p.lng, note: t('nearby.parkNote', { note }) })
              return (
              <li key={`${p.name}-${p.lat}`} className={`nearby__park ${activeId === `${p.name}-${p.lat}` ? 'is-active' : ''}`} {...bits.hover}>
                <button type='button' className='nearby__n' aria-pressed={activeId === `${p.name}-${p.lat}`} aria-label={t('nearby.showRoad', { name: p.name })} onClick={() => onPick?.(`${p.name}-${p.lat}`)}>{hotspots.length + i + 1}</button>
                <a href={mapsHref(p.lat, p.lng, p.name)} target='_blank' rel='noreferrer'>
                  <strong>{p.name}</strong>
                  <span className='nearby__reach'>{reach(p, unit)}</span>
                  <span>{t('nearby.notHotspot')}</span>
                  <em>{t('nearby.unlisted')}</em>
                </a>
                {bits.button}
              </li>
              )
            })}
          </ul>
        )}
      <p className='nearby__hint'>{t('nearby.hint')}</p>
    </div>
  )
}

export default NearbyPublic
