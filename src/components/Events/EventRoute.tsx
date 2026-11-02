import { useState, type ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { LoadingState } from '../Loading/Loading'
import { mapsUrl } from '../../routePlan'
import { shortDistance, useDistanceUnit, type DistanceUnit } from '../../distance'
import { t } from '../../i18n'
import type { EventRoute as Route } from '../../types'

type Stop = Route['stops'][number]
export type RouteBird = Stop['new_birds'][number]

const BIRDS_SHOWN = 5

/** "42 min", "3 h", "3 h 10 min". */
const driveTime = (minutes: number) => {
  const m = Math.round(minutes)
  if (m < 60) return t('eventRoute.min', { m })
  return m % 60 ? t('eventRoute.hMin', { h: Math.floor(m / 60), m: m % 60 }) : t('eventRoute.h', { h: m / 60 })
}

/** Google Maps directions to one stop, from wherever the phone is. */
const directionsTo = (stop: Stop) => `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`

/** Google Maps directions through every stop: from the start (or the first stop) to the last. */
const wholeRoute = (route: Route) => {
  const point = (s: Stop) => ({ locId: s.locId, name: s.locName, lat: s.lat, lng: s.lng })
  const origin = route.from ? { locId: null, name: t('route.myLocation'), ...route.from } : route.stops[0] ? point(route.stops[0]) : null
  return origin ? mapsUrl((route.from ? route.stops : route.stops.slice(1)).map(point), origin) : null
}

const RouteStop = ({ stop, n, unit, renderBird }: { stop: Stop; n: number; unit: DistanceUnit; renderBird: (bird: RouteBird, stop: Stop) => ReactNode }) => {
  const [open, setOpen] = useState(false)
  const extra = stop.new_birds.length - BIRDS_SHOWN
  const birds = open || extra <= 1 ? stop.new_birds : stop.new_birds.slice(0, BIRDS_SHOWN)
  return (
    <li className='event-route__stop' data-testid='route-stop'>
      {typeof stop.leg_min === 'number' && typeof stop.leg_mi === 'number' && (
        <p className='event-route__leg'>{t('eventRoute.leg', { time: driveTime(stop.leg_min), distance: shortDistance(stop.leg_mi, unit) })}</p>
      )}
      <div className='event-scouting__place'>
        <p className='event-scouting__place-head'>
          <span className='event-scouting__num' aria-hidden='true'>{n}</span>
          <strong className='event-scouting__place-name'>{stop.locName}</strong>
          <a className='event-route__directions' href={directionsTo(stop)} target='_blank' rel='noreferrer'
            aria-label={t('eventRoute.directionsTo', { place: stop.locName })}>{t('eventRoute.directions')}</a>
        </p>
        {stop.new_birds.length > 0 && (
          <>
            <p className='event-scouting__count'><strong>{t('eventRoute.newBirds', { count: stop.new_birds.length })}</strong></p>
            <ul className='event-scouting__birds'>
              {birds.map(bird => <li key={bird.code}>{renderBird(bird, stop)}</li>)}
              {birds.length < stop.new_birds.length && (
                <li><button type='button' className='event-scouting__bird event-scouting__more' aria-label={t('scoutingView.moreBirdsLabel', { count: extra, place: stop.locName })} onClick={() => setOpen(true)}>{t('scoutingView.moreBirds', { count: extra })}</button></li>
              )}
            </ul>
          </>
        )}
      </div>
    </li>
  )
}

/** A rounded "lat,lng": two decimals is about a kilometre, plenty for a start and no more precise than it needs to be. */
const rounded = (n: number) => String(Math.round(n * 100) / 100)

/**
 * The scouting route: the fewest places that cover the most reported targets, in drive order, with
 * the drive between them and links into Google Maps. It starts at the first stop, or from the
 * viewer's location when they ask.
 */
const EventRoute = ({ route, pending, failed, from, onFrom, lifers, renderBird }: {
  route: Route | undefined
  pending: boolean
  failed: boolean
  from: string | null
  onFrom: (from: string | null) => void
  lifers: boolean
  renderBird: (bird: RouteBird, stop: Stop) => ReactNode
}) => {
  const unit = useDistanceUnit()
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating('idle'); onFrom(`${rounded(pos.coords.latitude)},${rounded(pos.coords.longitude)}`) },
      () => setLocating('failed'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }
  const whole = route ? wholeRoute(route) : null
  const totals = route?.routed && typeof route.total_min === 'number' && typeof route.total_mi === 'number'

  return (
    <div className='event-route' data-testid='event-route'>
      {pending && <LoadingState variant='inline' label={t('eventRoute.loading')} />}
      {failed && <p className='notification__hint'>{t('eventRoute.failed')}</p>}
      {route && !pending && (
        route.stops.length === 0
          ? <p className='notification__hint'>{t('eventRoute.none')}</p>
          : <>
              <div className='event-route__summary'>
                <p className='event-route__headline'>
                  {totals
                    ? <Trans i18nKey='eventRoute.headline' count={route.stops.length}
                        values={{ count: route.stops.length, time: driveTime(route.total_min!), distance: shortDistance(route.total_mi!, unit) }} components={{ b: <strong /> }} />
                    : <Trans i18nKey='eventRoute.headlineStops' count={route.stops.length} values={{ count: route.stops.length }} components={{ b: <strong /> }} />}
                </p>
                <p className='event-route__covers'>{t(lifers ? 'eventRoute.coversLifers' : 'eventRoute.covers', { got: route.covered, count: route.reported })}</p>
                {!route.routed && <p className='event-route__note'>{t('eventRoute.unrouted')}</p>}
              </div>
              <div className='event-route__start'>
                {from
                  ? <>
                      <span className='event-route__note'>{t('eventRoute.fromYou')}</span>
                      <button type='button' className='link-button link-text' onClick={() => { setLocating('idle'); onFrom(null) }}>{t('eventRoute.fromFirst')}</button>
                    </>
                  : <button type='button' className='pill-button pill-button--small' onClick={locate} disabled={locating === 'busy'}>
                      {locating === 'busy' ? t('route.finding') : t('eventRoute.fromMe')}
                    </button>}
                {locating === 'failed' && <p className='event-route__note' role='status'>{t('eventRoute.locateFailed')}</p>}
              </div>
              <ol className='event-route__stops'>
                {route.stops.map((stop, i) => <RouteStop key={`${stop.locId}-${i}`} stop={stop} n={i + 1} unit={unit} renderBird={renderBird} />)}
              </ol>
              {whole && <a className='pill-button pill-button--small event-route__maps' href={whole} target='_blank' rel='noreferrer'>{t('eventRoute.openMaps')}</a>}
              {route.skipped > 0 && <p className='event-route__note'>{t('eventRoute.skipped', { count: route.skipped })}</p>}
            </>
      )}
    </div>
  )
}

export default EventRoute
