import { Link } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import Evidence from '../Evidence/Evidence'
import { LoadingState } from '../Loading/Loading'
import { useEventScoutingQuery } from '../../hooks/queries'
import { clockTime, daysUntil, t } from '../../i18n'
import type { GroupEvent } from '../../types'

/** "today", "yesterday", "3 days ago": when a report was made. */
const whenAgo = (obsDt: string) => {
  const ago = -daysUntil(obsDt.slice(0, 10))
  if (ago <= 0) return t('scoutingView.today')
  if (ago === 1) return t('scoutingView.yesterday')
  return t('scoutingView.daysAgo', { count: ago })
}

/**
 * Where an event's target birds have been reported lately in its area, and which haven't been: the
 * morning scouting report, any time. With no targets picked, the likely lifers for its dates stand in.
 */
const EventScouting = ({ event }: { event: GroupEvent }) => {
  const scouting = useEventScoutingQuery(event.id)
  const data = scouting.data
  const points: MapPoint[] = (data?.reported ?? [])
    .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
    .map(r => ({ id: `${r.code}-${r.subId ?? r.obsDt}`, lat: r.lat as number, lng: r.lng as number, title: r.comName ?? r.code, subtitle: r.locName, href: r.subId ? `/sighting/${r.code}/${r.subId}` : undefined }))
  const head = [
    t('scoutingView.title'),
    typeof data?.days_to_go === 'number' && data.days_to_go > 0 ? t('scoutingView.daysToGo', { count: data.days_to_go }) : null,
    data?.checked_at ? t('scoutingView.checked', { time: clockTime(new Date(data.checked_at)) }) : null
  ].filter(Boolean).join(' · ')

  return (
    <div className='event-page__section event-scouting' data-testid='event-scouting'>
      <p className='place__heading'>{head}</p>
      {scouting.isPending && <LoadingState variant='inline' label={t('scoutingView.loading')} />}
      {scouting.isError && <p className='notification__hint'>{t('scoutingView.failed')}</p>}
      {data && (
        <>
          {data.using === 'likely_lifers' && <p className='notification__hint event-scouting__fallback'>{t('scoutingView.fallback')}</p>}
          <p className='place__subheading'>{t('scoutingView.reported')}</p>
          {data.reported.length
            ? <ul className='event-scouting__list'>{data.reported.map(r => (
                <li key={`${r.code}-${r.subId ?? r.obsDt}`} className='event-scouting__item'>
                  <p className='event-scouting__what'>
                    {r.subId ? <Link to={`/sighting/${r.code}/${r.subId}`}><strong>{r.comName ?? r.code}</strong></Link> : <strong>{r.comName ?? r.code}</strong>}
                    {r.locName && <> · {r.locName}</>} · {whenAgo(r.obsDt)}
                  </p>
                  <Evidence evidence={{ confirmed: typeof r.confirmed === 'boolean' ? r.confirmed : null, media: Boolean(r.media), birders: r.birders ?? 0 }} compact />
                  {r.subId && <a className='event-scouting__checklist' href={`https://ebird.org/checklist/${r.subId}`} target='_blank' rel='noreferrer'>{t('scoutingView.checklist')}</a>}
                </li>
              ))}</ul>
            : <p className='notification__hint'>{t(data.using === 'likely_lifers' ? 'scoutingView.noneLifers' : 'scoutingView.none')}</p>}
          {data.unreported.length > 0 && (
            <p className='notification__hint event-scouting__unreported'>
              <strong>{t('scoutingView.unreported')}</strong> {data.unreported.map(u => u.comName ?? u.code).join(', ')}
            </p>
          )}
          {points.length > 0 && <div className='event-scouting__map'><SightingsMap points={points} height={220} ariaLabel={t('scoutingView.map', { name: event.name })} /></div>}
        </>
      )}
    </div>
  )
}

export default EventScouting
