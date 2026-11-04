import { useEffect, useState, type ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { LoadingState } from '../Loading/Loading'
import { mapsUrl } from '../../routePlan'
import { shortDistance, useDistanceUnit, type DistanceUnit } from '../../distance'
import { t } from '../../i18n'
import { duration } from '../../duration'
import { routeStay } from './customRoute'
import { prefersReducedMotion } from '../../routeDraw'
import type { EventRoute as Route } from '../../types'

type Stop = Route['stops'][number]
type Extra = NonNullable<Route['extras']>[number]
export type RouteBird = Stop['new_birds'][number]
type Place = Pick<Stop, 'locId' | 'locName' | 'lat' | 'lng' | 'new_birds' | 'private' | 'merged'>
type RenderBird = (bird: RouteBird, place: { locId: string }) => ReactNode

const BIRDS_SHOWN = 5
const EXTRAS_SHOWN = 3

const driveTime = duration

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

/** "Stay 45 min", with a muted "suggested" when the group hasn't set its own. */
export const StayText = ({ stop }: { stop: Pick<Stop, 'stay_min' | 'suggested_stay_min'> }) => {
  const minutes = stop.stay_min ?? stop.suggested_stay_min
  if (typeof minutes !== 'number') return null
  return (
    <p className='event-route__stay'>
      {t('routeTimes.stay', { time: duration(minutes) })}
      {(stop.stay_min === null || stop.stay_min === undefined) && <> <span className='event-route__tag event-route__stay-tag'>{t('routeTimes.suggested')}</span></>}
    </p>
  )
}

/** "Driving 1 h 49 min · At stops 3 h 30 min · Total 5 h 19 min"; without drive times, just the stops. */
export const RouteTotals = ({ drive, stay }: { drive: number | null; stay: number }) => (
  <p className='event-route__totals' data-testid='route-totals'>
    {typeof drive === 'number'
      ? <Trans i18nKey='routeTimes.totals' values={{ drive: duration(drive), stay: duration(stay), total: duration(drive + stay) }} components={{ b: <strong /> }} />
      : t('routeTimes.totalsNoDrive', { stay: duration(stay) })}
  </p>
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
      <StayText stop={stop} />
      <Merged place={stop} />
      {stop.new_birds.length > 0
        ? <>
            <p className='event-scouting__count'><strong>{t('eventRoute.newBirds', { count: stop.new_birds.length })}</strong></p>
            <Chips place={stop} renderBird={renderBird} />
          </>
        : <p className='event-route__note'>{t('eventRoute.noNewBirds')}</p>}
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

/**
 * The scouting route: the fewest places that cover the most reported targets, in drive order, with
 * the drive between them and links into Google Maps, then the optional stops worth it with time to
 * spare. Stops can be taken out and optional ones put in; the route is planned again each time.
 */
const EventRoute = ({ route, pending, updating, failed, failedText, heading = null, start, lifers, picked, renderBird, actions }: {
  route: Route | undefined
  pending: boolean
  /** An edit is on its way; the last route stays up meanwhile. */
  updating: boolean
  failed: boolean
  /** In place of the usual "couldn't plan a route" (no signal, and nothing saved). */
  failedText?: string
  /** The group's own route: "Your group's route · edited by Sam · 2 hours ago". Null for the suggestion. */
  heading?: string | null
  /** The group's meeting point, when one is saved. */
  start: { name: string } | null
  lifers: boolean
  /** An optional stop whose pin was tapped; each tap is a new object. */
  picked: { i: number } | null
  renderBird: RenderBird
  /** Edit route, Back to the suggested route: under the stops. */
  actions?: ReactNode
}) => {
  const unit = useDistanceUnit()
  const [allExtras, setAllExtras] = useState(false)
  useEffect(() => {
    if (picked) document.getElementById(extraRowId(picked.i))?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [picked])
  const whole = route ? wholeRoute(route) : null
  const totals = route?.routed && typeof route.total_min === 'number' && typeof route.total_mi === 'number'
  const extras = route?.extras ?? []
  // A tapped pin behind "Show more" reveals the rest.
  const extrasShown = allExtras || (picked && picked.i >= EXTRAS_SHOWN) ? extras : extras.slice(0, EXTRAS_SHOWN)
  const withExtras = route && typeof route.covered_with_extras === 'number' && route.covered_with_extras > route.covered ? route.covered_with_extras : null
  const coversKey = lifers ? 'eventRoute.coversLifers' : 'eventRoute.covers'
  const custom = heading !== null
  // Older servers send no stays; then there is nothing to add up.
  const hasStays = Boolean(route && (typeof route.stay_min_total === 'number' || route.stops.some(s => typeof (s.stay_min ?? s.suggested_stay_min) === 'number')))
  const startControl = (
    <p className='event-route__note event-route__start-name'>
      {start ? t('eventRoute.startingFrom', { name: start.name }) : t(route?.from ? 'eventRoute.fromMeetingPoint' : 'eventRoute.fromFirstStop')}
    </p>
  )

  return (
    <div className={`event-route ${updating ? 'is-updating' : ''}`} data-testid='event-route' aria-busy={updating || pending}>
      {pending && <LoadingState variant='inline' label={t('eventRoute.loading')} />}
      {failed && <p className='notification__hint'>{failedText ?? t('eventRoute.failed')}</p>}
      {failed && actions}
      {route && !pending && (
        route.stops.length === 0
          ? <>
              <p className='notification__hint'>{t('eventRoute.none')}</p>
              {startControl}
              {actions}
            </>
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
                {custom && <p className='event-route__note event-route__heading'>{heading}</p>}
                {!custom && route.incomplete && <p className='event-route__note'>{t('eventRoute.incomplete')}</p>}
                {!route.routed && <p className='event-route__note'>{t(custom ? 'eventRoute.unroutedCustom' : 'eventRoute.unrouted')}</p>}
                {updating && <p className='event-route__note' role='status'>{t('eventRoute.updating')}</p>}
              </div>
              {startControl}
              <ol className='event-route__stops'>
                {route.stops.map((stop, i) => <RouteStop key={`${stop.locId}-${i}`} stop={stop} n={i + 1} unit={unit} renderBird={renderBird} />)}
              </ol>
              {hasStays && <RouteTotals drive={route.routed ? route.total_min : null} stay={routeStay(route)} />}
              <div className='event-route__actions'>
                {whole && <a className='pill-button pill-button--small event-route__maps' href={whole} target='_blank' rel='noreferrer'>{t('eventRoute.openMaps')}</a>}
                {actions}
              </div>
              {route.skipped > 0 && <p className='event-route__note'>{t('eventRoute.skipped', { count: route.skipped })}</p>}
              {extras.length > 0 && (
                <div className='event-route__extras' data-testid='route-extras'>
                  <p className='place__subheading'>{t('eventRoute.extras')}</p>
                  <ul className='event-route__extra-list'>
                    {extrasShown.map((extra, i) => (
                      <ExtraRow key={`${extra.locId}-${i}`} extra={extra} i={i} active={picked?.i === i} unit={unit} renderBird={renderBird} />
                    ))}
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
