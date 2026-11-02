import { useEffect, useState, type ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { LoadingState } from '../Loading/Loading'
import PlaceSearch from '../PlaceSearch/PlaceSearch'
import { mapsUrl } from '../../routePlan'
import { shortDistance, useDistanceUnit, type DistanceUnit } from '../../distance'
import { t } from '../../i18n'
import { prefersReducedMotion } from '../../routeDraw'
import { round2, type RouteStart } from './routeChoices'
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

/** The name, with "personal spot" (and "removed", for a place taken out) beside it. */
const Name = ({ place, removed = false }: { place: Place; removed?: boolean }) => (
  <strong className='event-scouting__place-name'>
    {place.locName}
    {place.private && <> <span className='event-route__tag'>{t('eventRoute.personal')}</span></>}
    {removed && <> <span className='event-route__tag'>{t('eventRoute.removed')}</span></>}
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

const RouteStop = ({ stop, n, unit, busy, onRemove, renderBird }: { stop: Stop; n: number; unit: DistanceUnit; busy: boolean; onRemove: () => void; renderBird: RenderBird }) => (
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
      {stop.new_birds.length > 0
        ? <>
            <p className='event-scouting__count'><strong>{t('eventRoute.newBirds', { count: stop.new_birds.length })}</strong></p>
            <Chips place={stop} renderBird={renderBird} />
          </>
        : <p className='event-route__note'>{t('eventRoute.noNewBirds')}</p>}
      <button type='button' className='link-button link-text event-route__remove' disabled={busy} onClick={onRemove}
        aria-label={t('eventRoute.removeLabel', { place: stop.locName })}>{t('eventRoute.remove')}</button>
    </div>
  </li>
)

/** An optional stop: lighter than the route's own, with what it adds and what it costs. */
const ExtraRow = ({ extra, i, active, unit, busy, onAdd, onPutBack, renderBird }: {
  extra: Extra; i: number; active: boolean; unit: DistanceUnit; busy: boolean; onAdd: () => void; onPutBack: () => void; renderBird: RenderBird
}) => {
  const cost = [
    t('eventRoute.extraBirds', { count: extra.new_birds.length }),
    typeof extra.add_min === 'number' ? t('eventRoute.extraTime', { time: driveTime(extra.add_min) }) : null,
    typeof extra.add_mi === 'number' ? shortDistance(extra.add_mi, unit) : null
  ].filter(Boolean).join(' · ')
  return (
    <li id={extraRowId(i)} className={`event-route__extra ${active ? 'is-active' : ''}`} data-testid='route-extra'>
      <p className='event-scouting__place-head'>
        <Name place={extra} removed={Boolean(extra.dropped)} />
        <Directions place={extra} />
      </p>
      <p className='event-route__extra-cost'>{cost}</p>
      <Merged place={extra} />
      {extra.new_birds.length > 0 && <Chips place={extra} renderBird={renderBird} />}
      <button type='button' className='pill-button pill-button--small event-route__add' disabled={busy} onClick={extra.dropped ? onPutBack : onAdd}
        aria-label={t(extra.dropped ? 'eventRoute.putBackLabel' : 'eventRoute.addLabel', { place: extra.locName })}>
        {t(extra.dropped ? 'eventRoute.putBack' : 'eventRoute.add')}
      </button>
    </li>
  )
}

/**
 * Where the route starts: the viewer's own pick (a town, address, hotspot, typed coordinates or
 * their location), else the event's meeting point, else the first stop.
 */
const StartControl = ({ state, start, meetingPoint, onStart }: { state: string; start: RouteStart | null; meetingPoint: boolean; onStart: (start: RouteStart | null) => void }) => {
  const [choosing, setChoosing] = useState(false)
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const choose = (next: RouteStart | null) => { setChoosing(false); setLocating('idle'); onStart(next) }
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => choose({ name: t('route.myLocation'), lat: round2(pos.coords.latitude), lng: round2(pos.coords.longitude), mine: true }),
      () => setLocating('failed'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }
  if (choosing) {
    return (
      <div className='event-route__start event-route__start--choosing'>
        <PlaceSearch state={state} label={t('eventRoute.startFrom')} placeholder={t('eventRoute.startPlaceholder')} autoFocus
          onPick={(p) => choose({ name: p.name, lat: round2(p.lat), lng: round2(p.lng) })} />
        <div className='event-route__start-actions'>
          <button type='button' className='pill-button pill-button--small' onClick={locate} disabled={locating === 'busy'}>
            {locating === 'busy' ? t('route.finding') : t('route.useLocation')}
          </button>
          <button type='button' className='link-button link-text' onClick={() => { setChoosing(false); setLocating('idle') }}>{t('common.cancel')}</button>
        </div>
        {locating === 'failed' && <p className='event-route__note' role='status'>{t('eventRoute.locateFailed')}</p>}
      </div>
    )
  }
  return (
    <div className='event-route__start'>
      <span className='event-route__note event-route__start-name'>
        {start ? (start.mine ? t('eventRoute.fromYou') : t('eventRoute.startingFrom', { name: start.name })) : t(meetingPoint ? 'eventRoute.fromMeetingPoint' : 'eventRoute.fromFirstStop')}
      </span>
      <button type='button' className='link-button link-text' onClick={() => setChoosing(true)}>{t(start ? 'eventRoute.change' : 'eventRoute.startElsewhere')}</button>
      {start && <button type='button' className='link-button link-text' onClick={() => choose(null)}>{t('eventRoute.clear')}</button>}
    </div>
  )
}

/**
 * The scouting route: the fewest places that cover the most reported targets, in drive order, with
 * the drive between them and links into Google Maps, then the optional stops worth it with time to
 * spare. Stops can be taken out and optional ones put in; the route is planned again each time.
 */
const EventRoute = ({ route, pending, updating, failed, note, state, start, onStart, lifers, picked, renderBird, onAdd, onPutBack, onRemove }: {
  route: Route | undefined
  pending: boolean
  /** An edit is on its way; the last route stays up meanwhile. */
  updating: boolean
  failed: boolean
  /** Why the last change was undone (the server's words). */
  note: string | null
  /** The event's state or province, for the start search. */
  state: string
  start: RouteStart | null
  onStart: (start: RouteStart | null) => void
  lifers: boolean
  /** An optional stop whose pin was tapped; each tap is a new object. */
  picked: { i: number } | null
  renderBird: RenderBird
  onAdd: (locId: string) => void
  onPutBack: (locId: string) => void
  onRemove: (stop: Stop) => void
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
  const startControl = <StartControl state={state} start={start} meetingPoint={Boolean(route?.from) && !start} onStart={onStart} />

  return (
    <div className={`event-route ${updating ? 'is-updating' : ''}`} data-testid='event-route' aria-busy={updating || pending}>
      {pending && <LoadingState variant='inline' label={t('eventRoute.loading')} />}
      {failed && <p className='notification__hint'>{t('eventRoute.failed')}</p>}
      {note && <p className='notification__hint event-route__undone' role='status'>{note}</p>}
      {failed && start && startControl}
      {route && !pending && (
        route.stops.length === 0
          ? <>
              <p className='notification__hint'>{t('eventRoute.none')}</p>
              {startControl}
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
                {!route.routed && <p className='event-route__note'>{t('eventRoute.unrouted')}</p>}
                {updating && <p className='event-route__note' role='status'>{t('eventRoute.updating')}</p>}
              </div>
              {startControl}
              <ol className='event-route__stops'>
                {route.stops.map((stop, i) => <RouteStop key={`${stop.locId}-${i}`} stop={stop} n={i + 1} unit={unit} busy={updating} onRemove={() => onRemove(stop)} renderBird={renderBird} />)}
              </ol>
              {whole && <a className='pill-button pill-button--small event-route__maps' href={whole} target='_blank' rel='noreferrer'>{t('eventRoute.openMaps')}</a>}
              {route.skipped > 0 && <p className='event-route__note'>{t('eventRoute.skipped', { count: route.skipped })}</p>}
              {extras.length > 0 && (
                <div className='event-route__extras' data-testid='route-extras'>
                  <p className='place__subheading'>{t('eventRoute.extras')}</p>
                  <ul className='event-route__extra-list'>
                    {extrasShown.map((extra, i) => (
                      <ExtraRow key={`${extra.locId}-${i}`} extra={extra} i={i} active={picked?.i === i} unit={unit} busy={updating}
                        onAdd={() => onAdd(extra.locId)} onPutBack={() => onPutBack(extra.locId)} renderBird={renderBird} />
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
