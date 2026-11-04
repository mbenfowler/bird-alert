import { Link, useParams } from 'react-router'
import { useLoginHere } from '../../returnTo'
import { LoadingState } from '../Loading/Loading'
import { LoadProblem, OfflineNote } from '../Offline/Offline'
import SightingsMap from '../SightingsMap/SightingsMap'
import { useEventViewQuery, useSessionQuery } from '../../hooks/queries'
import { dateRange, t } from '../../i18n'
import '../Shared/Shared.css'
import '../AlertCenter/Places.css'
import './Events.css'

/**
 * The view-only link (/events/view/:token): an event's plan and, on the day, its tally (refreshed each
 * minute), for people who don't want an account. No names: just the birds. A quiet invitation to
 * Bird Alert for anyone not signed in.
 */
const EventView = () => {
  const { token = '' } = useParams()
  const loginHere = useLoginHere()
  const view = useEventViewQuery(token)
  const session = useSessionQuery()
  const signedIn = Boolean(session.data)
  if (view.isPending) return <LoadingState />
  if (view.isError && !view.data) return <section className='event-page'><LoadProblem error={view.error} missing={t('events.viewMissing')} /></section>
  if (!view.data) return <section className='event-page'><p className='event-page__missing'>{t('events.viewMissing')}</p></section>
  const v = view.data
  const tally = [...(v.tally ?? [])].sort((a, b) => b.added_at.localeCompare(a.added_at))
  // The group's route, read-only: no start (the meeting point stays with the group).
  const stops = (Array.isArray(v.route?.stops) ? v.route.stops : []).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  return (
    <article className='event-page'>
      <h1 className='fredericka event-page__title'>{v.name}</h1>
      <OfflineNote updatedAt={view.dataUpdatedAt} error={view.error} />
      <p className='event-page__what'>
        {v.kind === 'bigday' && <span className='place__badge'>{t('events.bigDay')}</span>}
        {' '}{dateRange(v.starts_on, v.ends_on)}{v.area ? ` · ${v.area}` : ''}
      </p>
      {!signedIn && (
        <aside className='shared__pitch event-page__pitch'>
          <p>{t('events.viewPrompt')}</p>
          <Link className='pill-button pill-button--primary' to={loginHere}>{t('events.viewPromptButton')}</Link>
        </aside>
      )}
      <section className='event-page__section' aria-labelledby='viewTally'>
        <h2 id='viewTally' className='event-page__subhead'>{t('events.viewTally')}</h2>
        {tally.length || v.active
          ? <>
              <p className='event-page__count' data-testid='view-count'>{t('events.viewCount', { count: v.count ?? tally.length })}</p>
              <ol className='event-tally__list event-tally__list--plain'>{tally.map(entry => <li key={entry.code}>{entry.comName ?? entry.code}</li>)}</ol>
            </>
          : <p className='notification__hint'>{t('events.viewNoTally')}</p>}
      </section>
      {stops.length > 0 && (
        <section className='event-page__section' aria-labelledby='viewRoute' data-testid='view-route'>
          <h2 id='viewRoute' className='event-page__subhead'>{t('events.viewRoute')}</h2>
          <ol className='event-view__stops'>
            {stops.map((stop, i) => (
              <li key={`${stop.locId ?? ''}-${i}`}><span className='event-scouting__num' aria-hidden='true'>{i + 1}</span><span>{stop.name}</span></li>
            ))}
          </ol>
          <div className='event-scouting__map'>
            {/* Straight lines between the stops: this page needs no account, and the order is what matters. */}
            <SightingsMap points={[]} height={220} ariaLabel={t('events.viewRouteMap', { name: v.name })}
              route={{ path: stops.map(s => [s.lat, s.lng] as [number, number]), stops: stops.map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.name}` })) }} />
          </div>
        </section>
      )}
      {v.targets.length > 0 && (
        <section className='event-page__section' aria-labelledby='viewTargets'>
          <h2 id='viewTargets' className='event-page__subhead'>{t('events.viewTargets')}</h2>
          <ul className='place__chips'>{v.targets.map(target => <li key={target.code} className='place__chip'>{target.comName ?? target.code}</li>)}</ul>
        </section>
      )}
    </article>
  )
}

export default EventView
