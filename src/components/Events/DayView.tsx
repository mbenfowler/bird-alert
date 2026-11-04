import { Link } from 'react-router'
import { LoadingState } from '../Loading/Loading'
import { ClockIcon } from '../Icons/Icons'
import { clockTimeIn, t } from '../../i18n'
import { duration } from '../../duration'
import { shortDistance, useDistanceUnit } from '../../distance'
import { isNetworkError } from '../../offline'
import { routeLinks } from '../../routePlan'
import type { SunTimes } from '../../solar'
import type { GroupEvent } from '../../types'
import { BEHIND_SLACK_MIN, appleDirections, googleDirections, notOnMyChecklist, stillNeededAt, trimSuggestion, type DayStop } from './daySchedule'
import { eventPath } from './events'
import type { EventDay } from './useEventDay'

type NameOf = (code: string) => string

/** "Nautical dawn 5:50 AM · Civil dawn 6:20 AM · Sunrise 6:45 AM · Sunset 5:25 PM · Civil dusk 5:51 PM", in the event's zone. */
export const SunLine = ({ sun, timeZone }: { sun: SunTimes | null; timeZone?: string }) => {
  if (!sun) return null
  const items = ([
    ['nauticalDawn', sun.nauticalDawn], ['civilDawn', sun.civilDawn], ['sunrise', sun.sunrise],
    ['sunset', sun.sunset], ['civilDusk', sun.civilDusk], ['nauticalDusk', sun.nauticalDusk]
  ] as const).filter(([, at]) => at)
  if (!items.length) return null
  return (
    <ul className='event-day__sun' data-testid='sun-times' aria-label={t('eventDay.sunLabel')}>
      {items.map(([key, at]) => <li key={key}>{t(`eventDay.${key}`, { time: clockTimeIn(at!, timeZone) })}</li>)}
    </ul>
  )
}

/** "15 min behind · trim Carr Canyon?", "10 min ahead" or "On schedule"; nothing with no times to compare. */
const ScheduleLine = ({ day, neededAt }: { day: EventDay; neededAt: (stop: DayStop) => number }) => {
  const behind = day.state.behindMin
  if (behind === null) return null
  const trim = behind >= 15 ? trimSuggestion(day.stops, day.state.at ?? -1, neededAt) : null
  const text = behind >= BEHIND_SLACK_MIN
    ? [t('eventDay.behind', { time: duration(behind) }), trim ? t('eventDay.trim', { name: trim.name }) : null].filter(Boolean).join(' · ')
    : behind <= -BEHIND_SLACK_MIN ? t('eventDay.ahead', { time: duration(-behind) }) : t('eventDay.onSchedule')
  return <p className={`event-day__schedule ${behind >= BEHIND_SLACK_MIN ? 'is-behind' : ''}`} data-testid='schedule-status' role='status'>{text}</p>
}

/** The targets reported at a stop this week, those already on the tally crossed off. */
const NeededHere = ({ stop, day, nameOf }: { stop: DayStop; day: EventDay; nameOf: NameOf }) => {
  const reported = stop.species.filter(code => day.targets.includes(code))
  if (!reported.length) return null
  const needed = stillNeededAt(stop, day.targets, day.tallyCodes)
  return (
    <div className='event-day__needed' data-testid='needed-here'>
      <p className='place__subheading'>{needed.length ? t('eventDay.neededHere', { count: needed.length }) : t('eventDay.neededHereNone')}</p>
      <ul className='place__chips'>
        {reported.map(code => {
          const got = !needed.includes(code)
          return (
            <li key={code} className={`place__chip event-day__target ${got ? 'is-got' : ''}`} data-got={got ? 'true' : undefined}>
              {got && <span aria-hidden='true'>✓ </span>}{nameOf(code)}
              {got && <span className='visually-hidden'> {t('eventDay.gotIt')}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const StopHead = ({ stop, extra }: { stop: DayStop; extra?: string | null }) => (
  <p className='event-scouting__place-head'>
    <span className='event-scouting__num' aria-hidden='true'>{stop.index + 1}</span>
    <strong className='event-scouting__place-name'>{stop.name}</strong>
    {extra && <span className='event-day__meta'>{extra}</span>}
  </p>
)

/** Big Directions in Google Maps, Apple Maps beside it. */
const Directions = ({ to }: { to: { name: string; lat: number; lng: number } }) => (
  <p className='place__actions event-day__directions'>
    <a className='pill-button pill-button--primary' href={googleDirections(to)} target='_blank' rel='noreferrer' data-testid='directions-google'>{t('eventDay.directionsTo', { name: to.name })}</a>
    <a className='link-button link-text' href={appleDirections(to)} target='_blank' rel='noreferrer' data-testid='directions-apple'>{t('eventDay.appleMaps')}</a>
  </p>
)

/**
 * The day itself, at the top of the event page: the sun, where the group is on its route (kept on
 * this phone), the stop's timer and what's still to find there, the next stop with directions, and
 * the way into the tally and the group log.
 */
const DayView = ({ event, day, nameOf }: { event: GroupEvent; day: EventDay; nameOf: NameOf }) => {
  const unit = useDistanceUnit()
  const { stops, state, planned, timeZone, position } = day
  const arrive = (index: number) => day.setPosition(index)
  const start = () => day.setPosition(day.route?.start ? -1 : 0)
  const reset = () => day.setPosition(null)
  const where = position && position.stop !== null
    ? position.stop < 0 ? day.route?.start?.name ?? null : stops[position.stop]?.name ?? null
    : null
  const neededAt = (stop: DayStop) => stillNeededAt(stop, day.targets, day.tallyCodes).length
  const current = state.at !== null ? stops[state.at] : null
  const next = state.next !== null ? stops[state.next] : null
  const toDo = notOnMyChecklist(day.tally).length
  const species = new Set(day.tallyCodes).size
  const latest = [...day.tally].filter(e => e.stop_name).sort((a, b) => (b.observed_at ?? b.added_at).localeCompare(a.observed_at ?? a.added_at))[0]
  const plannedAt = (stop: DayStop) => planned[stop.index] ? t('eventDay.plannedAt', { time: clockTimeIn(planned[stop.index]!.arrive, timeZone) }) : null
  const legText = (stop: DayStop) => [
    typeof stop.legMi === 'number' ? shortDistance(stop.legMi, unit) : null,
    typeof stop.legMin === 'number' ? duration(stop.legMin) : null,
    plannedAt(stop)
  ].filter(Boolean).join(' · ')

  return (
    <div className='event-page__section event-day' data-testid='day-view'>
      <h2 className='place__heading'>{t('eventDay.heading')}</h2>
      <SunLine sun={day.sun} timeZone={timeZone} />
      <p className='place__actions event-day__tally'>
        <Link className='pill-button pill-button--primary' to={`${eventPath(event.id)}/tally`} data-testid='day-open-tally'>{t('eventDay.openTally', { count: species })}</Link>
        <Link className='pill-button' to={`${eventPath(event.id)}/log`} data-testid='day-open-log'>
          {t('eventDay.groupLog')}
          {toDo > 0 && <span className='place__badge' data-testid='checklist-badge' aria-label={t('eventDay.toDoLabel', { count: toDo })}>{toDo}</span>}
        </Link>
      </p>
      {day.loading && <LoadingState variant='inline' label={t('eventRoute.loading')} />}
      {day.failed && <p className='notification__hint'>{isNetworkError(day.error) ? t('offline.noSignalNothingSaved') : t('eventDay.noRoute')}</p>}
      {day.route && !stops.length && <p className='notification__hint'>{t('eventDay.noRoute')}</p>}
      {stops.length > 0 && (
        <>
          {position && where && (
            <p className='event-day__position' data-testid='group-position'>
              {t('eventDay.positionAt', { place: where, name: position.by_you ? t('events.youLower') : position.by_name || t('eventLog.someone'), time: clockTimeIn(new Date(position.at), timeZone) })}
              {position.pending && <span className='event-day__waiting' data-testid='position-waiting'><ClockIcon />{t('offline.waitingOne')}</span>}
            </p>
          )}
          <ScheduleLine day={day} neededAt={neededAt} />
          {current && (
            <div className='event-day__stop event-day__stop--now' data-testid='stop-now'>
              <p className='place__subheading'>{t('eventDay.nowAt')}</p>
              <StopHead stop={current} />
              {state.stayMin
                ? <p className='event-day__timer' data-testid='stop-timer'>{t('eventDay.timer', { here: state.minutesHere, stay: state.stayMin })}</p>
                : <p className='event-day__timer' data-testid='stop-timer'>{t('eventDay.timerNoStay', { here: state.minutesHere })}</p>}
              {state.over && <p className='event-day__go' role='status' data-testid='time-to-go'>{next ? t('eventDay.timeToGo', { name: next.name }) : t('eventDay.lastStop')}</p>}
              <NeededHere stop={current} day={day} nameOf={nameOf} />
            </div>
          )}
          {state.phase === 'before' && !day.route?.start && (
            <div className='event-day__stop' data-testid='stop-next'>
              <p className='place__subheading'>{t('eventDay.firstStop')}</p>
              <StopHead stop={stops[0]!} extra={plannedAt(stops[0]!)} />
              <Directions to={stops[0]!} />
              <p className='place__actions'><button type='button' className='pill-button' onClick={start} data-testid='start-day'>{t('eventDay.startDay')}</button></p>
              <NeededHere stop={stops[0]!} day={day} nameOf={nameOf} />
            </div>
          )}
          {state.phase === 'before' && day.route?.start && (
            <div className='event-day__stop' data-testid='stop-next'>
              <p className='place__subheading'>{t('eventDay.meetAt', { name: day.route.start.name })}</p>
              <Directions to={day.route.start} />
              <p className='place__actions'><button type='button' className='pill-button' onClick={start} data-testid='start-day'>{t('eventDay.startDay')}</button></p>
            </div>
          )}
          {state.phase !== 'before' && next && (
            <div className='event-day__stop' data-testid='stop-next'>
              <p className='place__subheading'>{t('eventDay.nextStop')}</p>
              <StopHead stop={next} extra={legText(next)} />
              <Directions to={next} />
              <p className='place__actions'><button type='button' className='pill-button' onClick={() => arrive(next.index)} data-testid='were-here'>{t('eventDay.weAreHere')}</button></p>
              {!current && <NeededHere stop={next} day={day} nameOf={nameOf} />}
            </div>
          )}
          {latest?.stop_name && (
            <p className='notification__hint' data-testid='group-last'>
              {t('eventDay.groupLast', { bird: nameOf(latest.code), place: latest.stop_name, name: latest.added_by_you ? t('events.you') : latest.added_by_name ?? '', time: clockTimeIn(new Date(latest.observed_at ?? latest.added_at), timeZone) })}
            </p>
          )}
          <p className='notification__hint event-day__device'>
            {state.phase !== 'before' && <button type='button' className='link-button link-text' onClick={reset} data-testid='start-over'>{t('eventDay.startOver')}</button>}
          </p>
        </>
      )}
    </div>
  )
}

/** "Meeting point · 5:30 AM" then each stop with its drive, its planned times, a 🦉 before civil dawn, and Directions. */
export const DayStops = ({ day, onDay }: { day: EventDay; onDay: boolean }) => {
  const unit = useDistanceUnit()
  const { stops, planned, timeZone, state } = day
  if (!day.route || !stops.length) return null
  const start = day.route.start
  const dawn = day.sun?.civilDawn ?? null
  const startAt = planned[0] ? new Date(planned[0].arrive.getTime() - (stops[0]!.legMin ?? 0) * 60_000) : null
  const links = routeLinks(stops.map(s => ({ locId: s.locId, name: s.name, lat: s.lat, lng: s.lng })), start ? { locId: null, ...start } : null)
  const partLabel = (from: number | null, to: number) => (from === null ? t('eventDay.partFromMeet', { to }) : t('eventDay.partStops', { from, to }))
  return (
    <div className='event-page__section event-day__plan' data-testid='day-stops'>
      <h2 className='place__heading'>{t('eventDay.stopsHeading')}</h2>
      {!startAt && <p className='notification__hint'>{t('eventDay.meetingNone')}</p>}
      <ol className='event-route__stops event-day__stops'>
        {start && (
          <li className='event-route__stop event-day__row'>
            <p className='event-scouting__place-head'>
              <strong className='event-scouting__place-name'>{t('eventDay.meetRow', { name: start.name })}</strong>
              {startAt && <span className='event-day__meta' data-testid='meet-time'>{clockTimeIn(startAt, timeZone)}</span>}
            </p>
          </li>
        )}
        {stops.map(stop => {
          const p = planned[stop.index]
          const owl = Boolean(p && dawn && p.arrive < dawn)
          const isNow = state.at === stop.index
          const isNext = !isNow && state.next === stop.index && state.phase !== 'before'
          return (
            <li key={`${stop.locId ?? stop.name}-${stop.index}`} className={`event-route__stop event-day__row ${isNow ? 'is-now' : ''} ${isNext ? 'is-next' : ''}`} data-testid='day-stop'>
              {(typeof stop.legMin === 'number' || typeof stop.legMi === 'number') && (
                <p className='event-route__leg'>{[typeof stop.legMin === 'number' ? duration(stop.legMin) : null, typeof stop.legMi === 'number' ? shortDistance(stop.legMi, unit) : null].filter(Boolean).join(' · ')}</p>
              )}
              <p className='event-scouting__place-head'>
                <span className='event-scouting__num' aria-hidden='true'>{stop.index + 1}</span>
                <strong className='event-scouting__place-name'>{stop.name}</strong>
                <a className='event-route__directions' href={googleDirections(stop)} target='_blank' rel='noreferrer' aria-label={t('eventRoute.directionsTo', { place: stop.name })}>{t('eventRoute.directions')}</a>
              </p>
              <p className='event-day__times'>
                {p && <span data-testid='planned-time'>{t('eventDay.plannedRange', { from: clockTimeIn(p.arrive, timeZone), to: clockTimeIn(p.leave, timeZone) })}</span>}
                {stop.stayMin > 0 && <span>{t('routeTimes.stay', { time: duration(stop.stayMin) })}</span>}
                {owl && <span className='event-route__tag event-day__owl' data-testid='owl'>{t('eventDay.owling')}</span>}
                {isNow && <span className='place__badge'>{t('eventDay.here')}</span>}
                {isNext && <span className='place__badge place__badge--quiet'>{t('eventDay.next')}</span>}
              </p>
              {onDay && !isNow && (
                <button type='button' className='link-button link-text event-day__here-link' onClick={() => day.setPosition(stop.index)}>
                  {t('eventDay.weAreHereAt', { name: stop.name })}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <RouteLinks links={links} partLabel={partLabel} />
    </div>
  )
}

/** The whole route in Google Maps: one link, or parts of at most three stops in between (a phone's Google Maps drops the rest). */
export const RouteLinks = ({ links, partLabel }: { links: { url: string; from: number | null; to: number }[]; partLabel: (from: number | null, to: number) => string }) => {
  if (!links.length) return null
  if (links.length === 1) return <p className='place__actions'><a className='pill-button pill-button--small event-route__maps' href={links[0]!.url} target='_blank' rel='noreferrer' data-testid='route-link'>{t('eventRoute.openMaps')}</a></p>
  return (
    <div className='event-day__parts'>
      <p className='place__actions'>
        {links.map((link, i) => (
          <a key={link.url} className='pill-button pill-button--small event-route__maps' href={link.url} target='_blank' rel='noreferrer' data-testid='route-link'>
            {t('eventDay.part', { n: i + 1, stops: partLabel(link.from, link.to) })}
          </a>
        ))}
      </p>
      <p className='event-route__note'>{t('eventDay.partsWhy')}</p>
    </div>
  )
}

export default DayView
