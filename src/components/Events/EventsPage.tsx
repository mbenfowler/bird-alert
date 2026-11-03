import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useEventsQuery } from '../../hooks/queries'
import { useAreaName } from '../../shownArea'
import { dateRange, t } from '../../i18n'
import type { GroupEvent } from '../../types'
import { eventPath, isGroup, isPast, isScouting, membersText, recapText } from './events'
import '../AlertCenter/Places.css'
import './Events.css'

/** One event in the list: its name, where and when, what's going on now, and how a past one went. */
const EventRow = ({ event }: { event: GroupEvent }) => {
  const areaName = useAreaName(event.state, event.location)
  const past = isPast(event)
  return (
    <li className={`events-list__item ${event.active ? 'is-today' : ''}`} data-event={String(event.id)}>
      <Link className='events-list__link' to={eventPath(event.id)}>
        <span className='events-list__name'>
          <strong>{event.name}</strong>
          {event.active && <span className='place__badge'>{t('events.today')}</span>}
          {!past && isScouting(event) && <span className='place__badge place__badge--scouting'>{t('events.scouting')}</span>}
          {event.kind === 'bigday' && <span className='place__badge place__badge--quiet'>{t('events.bigDay')}</span>}
        </span>
        <span className='events-list__what'>{areaName} · {dateRange(event.starts_on, event.ends_on)}</span>
        {past
          ? <span className='events-list__recap' data-testid='event-recap'>{recapText(event)}</span>
          : isGroup(event) && <span className='events-list__who'>{membersText(event.members)}</span>}
      </Link>
    </li>
  )
}

/**
 * Events (/events): dated outings, solo or with a group. Upcoming first (today's at the top), then
 * past ones newest first with how they went; archived ones only when asked for.
 */
const EventsPage = () => {
  const events = useEventsQuery()
  // Arrived from an old trip link (see oldTripId): say where trips went.
  const tripsMoved = Boolean((useLocation().state as { tripsMoved?: boolean } | null)?.tripsMoved)
  const [showArchived, setShowArchived] = useState(false)
  const all = events.data ?? []
  const upcoming = all.filter(e => !e.archived && !isPast(e))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.starts_on.localeCompare(b.starts_on))
  const past = all.filter(e => !e.archived && isPast(e)).sort((a, b) => b.ends_on.localeCompare(a.ends_on))
  const archived = all.filter(e => e.archived).sort((a, b) => b.starts_on.localeCompare(a.starts_on))
  return (
    <section className='event-page events-page'>
      <div className='events-page__head'>
        <h1 className='fredericka event-page__title'>{t('events.pageTitle')}</h1>
        <Link className='pill-button pill-button--primary' to='/events/new'>{t('events.new')}</Link>
      </div>
      {tripsMoved && <p className='notification__hint events-page__moved' role='status' data-testid='trips-moved'>{t('events.tripsMoved')}</p>}
      <p className='notification__hint'>{t('events.pageHint')}</p>
      {events.isPending && <LoadingState />}
      {events.isError && <ErrorMessage networkError={errorMessage(events.error)} />}
      {events.data && (
        <>
          <h2 className='place__heading events-page__heading'>{t('events.upcoming')}</h2>
          {upcoming.length
            ? <ul className='events-list' data-testid='events-upcoming'>{upcoming.map(event => <EventRow key={event.id} event={event} />)}</ul>
            : <p className='notification__hint'>{t('events.upcomingNone')}</p>}
          {past.length > 0 && (
            <>
              <h2 className='place__heading events-page__heading'>{t('events.past')}</h2>
              <ul className='events-list' data-testid='events-past'>{past.map(event => <EventRow key={event.id} event={event} />)}</ul>
            </>
          )}
          {archived.length > 0 && (
            <>
              <button type='button' className='link-button link-text events-page__archived' aria-expanded={showArchived} onClick={() => setShowArchived(s => !s)}>
                {showArchived ? t('events.hideArchived') : t('events.showArchived', { count: archived.length })}
              </button>
              {showArchived && <ul className='events-list events-list--archived' data-testid='events-archived'>{archived.map(event => <EventRow key={event.id} event={event} />)}</ul>}
            </>
          )}
        </>
      )}
    </section>
  )
}

export default EventsPage
