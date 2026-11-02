import { useEffect, useState, type ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { LoadingState } from '../Loading/Loading'
import { mapsUrl } from '../../routePlan'
import { shortDistance, useDistanceUnit, type DistanceUnit } from '../../distance'
import { t } from '../../i18n'
import { prefersReducedMotion } from '../../routeDraw'
import type { EventRoute as Route } from '../../types'

type Stop = Route['stops'][number]
type Extra = NonNullable<Route['extras']>[number]
export type RouteBird = Stop['new_birds'][number]
type Place = Pick<Stop, 'locId' | 'locName' | 'lat' | 'lng' | 'new_birds' | 'private' | 'merged'>
type RenderBird = (bird: RouteBird, place: { locId: string }) => ReactNode

const BIRDS_SHOWN = 5
const EXTRAS_SHOWN = 3

/** "42 min", "3 h", "3 h 10 min". */
const driveTime = (minutes: number) => {
  const m = Math.round(minutes)
  if (m < 60) return t('eventRoute.min', { m })
  return m % 60 ? t('eventRoute.hMin', { h: Math.floor(m / 60), m: m % 60 }) : t('eventRoute.h', { h: m / 60 })
}

/** Google Maps directions to one place, from wherever the phone is. */
const directionsTo = (place: Place) => `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`

/** Google Maps directions through every stop: from the start (or the first stop) to the last. */
const wholeRoute = (route: Route) => {
  const point = (s: Stop) => ({ locId: s.locId, name: s.locName, lat: s.lat, lng: s.lng })
  const origin = route.from ? { locId: null, name: t('route.myLocation'), ...route.from } : route.stops[0] ? point(route.stops[0]) : null
  return origin ? mapsUrl((route.from ? route.stops : route.stops.slice(1)).map(point), origin) : null
}

/** The row for an optional stop, so a tapped grey pin can bring it into view. */
const extraRowId = (i: number) => `route-extra-${i}`

/** A place's new birds: five, then the rest behind "+N more". */
const Chips = ({ place, renderBird }: { place: Place; renderBird: RenderBird }) => {
  const [open, setOpen] = useState(false)
  const extra = place.new_birds.length - BIRDS_SHOWN
  const birds = open || extra <= 1 ? place.new_birds : place.new_birds.slice(0, BIRDS_SHOWN)
  return (
    <ul className='event-scouting__birds'>
      {birds.map(bird => <li key={bird.code}>{renderBird(bird, place)}</li>)}
      {birds.length < place.new_birds.length && (
        <li><button type='button' className='event-scouting__bird event-scouting__more' aria-label={t('scoutingView.moreBirdsLabel', { count: extra, place: place.locName })} onClick={() => setOpen(true)}>{t('scoutingView.moreBirds', { count: extra })}</button></li>
      )}
    </ul>
  )
}

/** The name, with "personal spot" beside it when it is one. */
const Name = ({ place }: { place: Place }) => (
  <strong className='event-scouting__place-name'>
    {place.locName}
    {place.private && <> <span className='event-route__tag'>{t('eventRoute.personal')}</span></>}
  </strong>
)

/** "includes reports from 2 nearby personal spots", when some were folded into this place. */
const Merged = ({ place }: { place: Place }) => (place.merged?.length
  ? <p className='event-route__merged' title={place.merged.map(m => m.locName).join(', ')}>{t('eventRoute.merged', { count: place.merged.length })}</p>
  : null)

const Directions = ({ place }: { place: Place }) => (
  <a className='event-route__directions' href={directionsTo(place)} target='_blank' rel='noreferrer'
    aria-label={t('eventRoute.directionsTo', { place: place.locName })}>{t('eventRoute.directions')}</a>
)

const RouteStop = ({ stop, n, unit, renderBird }: { stop: Stop; n: number; unit: DistanceUnit; renderBird: RenderBird }) => (
  <li className='event-route__stop' data-testid='route-stop'>
    {typeof stop.leg_min === 'number' && typeof stop.leg_mi === 'number' && (
      <p className='event-route__leg'>{t('eventRoute.leg', { time: driveTime(stop.leg_min), distance: shortDistance(stop.leg_mi, unit) })}</p>
    )}
    <div className='event-scouting__place'>
      <p className='event-scouting__place-head'>
        <span className='event-scouting__num' aria-hidden='true'>{n}</span>
        <Name place={stop} />
        <Directions place={stop} />
      </p>
      <Merged place={stop} />
      {stop.new_birds.length > 0 && (
        <>
          <p className='event-scouting__count'><strong>{t('eventRoute.newBirds', { count: stop.new_birds.length })}</strong></p>
          <Chips place={stop} renderBird={renderBird} />
        </>
      )}
    </div>
  </li>
)

/** An optional stop: lighter than the route's own, with what it adds and what it costs. */
const ExtraRow = ({ extra, i, active, unit, renderBird }: { extra: Extra; i: number; active: boolean; unit: DistanceUnit; renderBird: RenderBird }) => {
  const cost = [
    t('eventRoute.extraBirds', { count: extra.new_birds.length }),
    typeof extra.add_min === 'number' ? t('eventRoute.extraTime', { time: driveTime(extra.add_min) }) : null,
    typeof extra.add_mi === 'number' ? shortDistance(extra.add_mi, unit) : null
  ].filter(Boolean).join(' · ')
  return (
    <li id={extraRowId(i)} className={`event-route__extra ${active ? 'is-active' : ''}`} data-testid='route-extra'>
      <p className='event-scouting__place-head'>
        <Name place={extra} />
        <Directions place={extra} />
      </p>
      <p className='event-route__extra-cost'>{cost}</p>
      <Merged place={extra} />
      {extra.new_birds.length > 0 && <Chips place={extra} renderBird={renderBird} />}
    </li>
  )
}

/** A rounded "lat,lng": two decimals is about a kilometre, plenty for a start and no more precise than it needs to be. */
const rounded = (n: number) => String(Math.round(n * 100) / 100)

/**
 * The scouting route: the fewest places that cover the most reported targets, in drive order, with
 * the drive between them and links into Google Maps, then the optional stops worth it with time to
 * spare. It starts at the event's meeting point when it has one (else the first stop), or from the
 * viewer's location when they ask.
 */
const EventRoute = ({ route, pending, failed, from, onFrom, lifers, picked, renderBird }: {
  route: Route | undefined
  pending: boolean
  failed: boolean
  /** The viewer's own start, when they shared it. */
  from: string | null
  onFrom: (from: string | null) => void
  lifers: boolean
  /** An optional stop whose pin was tapped; each tap is a new object. */
  picked: { i: number } | null
  renderBird: RenderBird
}) => {
  const unit = useDistanceUnit()
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [allExtras, setAllExtras] = useState(false)
  useEffect(() => {
    if (picked) document.getElementById(extraRowId(picked.i))?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [picked])
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
  const extras = route?.extras ?? []
  // A tapped pin behind "Show more" reveals the rest.
  const extrasShown = allExtras || (picked && picked.i >= EXTRAS_SHOWN) ? extras : extras.slice(0, EXTRAS_SHOWN)
  const withExtras = route && typeof route.covered_with_extras === 'number' && route.covered_with_extras > route.covered ? route.covered_with_extras : null
  const coversKey = lifers ? 'eventRoute.coversLifers' : 'eventRoute.covers'

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
                <p className='event-route__covers'>
                  {withExtras !== null
                    ? t(`${coversKey}Extras`, { got: route.covered, count: route.reported, extras: withExtras })
                    : t(coversKey, { got: route.covered, count: route.reported })}
                </p>
                {!route.routed && <p className='event-route__note'>{t('eventRoute.unrouted')}</p>}
              </div>
              <div className='event-route__start'>
                {from
                  ? <>
                      <span className='event-route__note'>{t('eventRoute.fromYou')}</span>
                      <button type='button' className='link-button link-text' onClick={() => { setLocating('idle'); onFrom(null) }}>{t('eventRoute.fromDefault')}</button>
                    </>
                  : <>
                      {route.from && <span className='event-route__note'>{t('eventRoute.fromMeetingPoint')}</span>}
                      <button type='button' className='pill-button pill-button--small' onClick={locate} disabled={locating === 'busy'}>
                        {locating === 'busy' ? t('route.finding') : t('eventRoute.fromMe')}
                      </button>
                    </>}
                {locating === 'failed' && <p className='event-route__note' role='status'>{t(route.from ? 'eventRoute.locateFailedMeeting' : 'eventRoute.locateFailed')}</p>}
              </div>
              <ol className='event-route__stops'>
                {route.stops.map((stop, i) => <RouteStop key={`${stop.locId}-${i}`} stop={stop} n={i + 1} unit={unit} renderBird={renderBird} />)}
              </ol>
              {whole && <a className='pill-button pill-button--small event-route__maps' href={whole} target='_blank' rel='noreferrer'>{t('eventRoute.openMaps')}</a>}
              {route.skipped > 0 && <p className='event-route__note'>{t('eventRoute.skipped', { count: route.skipped })}</p>}
              {extras.length > 0 && (
                <div className='event-route__extras' data-testid='route-extras'>
                  <p className='place__subheading'>{t('eventRoute.extras')}</p>
                  <ul className='event-route__extra-list'>
                    {extrasShown.map((extra, i) => <ExtraRow key={`${extra.locId}-${i}`} extra={extra} i={i} active={picked?.i === i} unit={unit} renderBird={renderBird} />)}
                  </ul>
                  {extrasShown.length < extras.length && (
                    <button type='button' className='pill-button pill-button--small event-route__more-extras' onClick={() => setAllExtras(true)}>
                      {t('eventRoute.moreExtras', { count: extras.length - extrasShown.length })}
                    </button>
                  )}
                </div>
              )}
            </>
      )}
    </div>
  )
}

export default EventRoute
