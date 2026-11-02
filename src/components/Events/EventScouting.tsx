import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Trans } from 'react-i18next'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import { LoadingState } from '../Loading/Loading'
import { useEventScoutingQuery } from '../../hooks/queries'
import { clockTime, daysUntil, t } from '../../i18n'
import { prefersReducedMotion } from '../../routeDraw'
import type { EventScouting as Scouting, GroupEvent } from '../../types'

type Report = Scouting['reported'][number]

/** "today", "yesterday", "3 days ago": when a report was made. */
const whenAgo = (obsDt: string) => {
  const ago = -daysUntil(obsDt.slice(0, 10))
  if (ago <= 0) return t('scoutingView.today')
  if (ago === 1) return t('scoutingView.yesterday')
  return t('scoutingView.daysAgo', { count: ago })
}

/** A target bird at one place: its latest report there. */
interface PlaceBird { code: string; name: string; report: Report }

/** One place the targets were reported lately, its birds newest first. */
interface Place {
  key: string
  name: string
  lat: number | null
  lng: number | null
  latest: Report
  /** The latest checklist at the place, for the one eBird link. */
  subId: string | null
  birds: PlaceBird[]
}

/**
 * Reports grouped by place (locId), one entry per bird; most targets first, then the freshest.
 * Reports arrive newest first, so the first one seen for a place or a bird is its latest.
 */
const groupByPlace = (reported: Report[]): Place[] => {
  const places = new Map<string, Place>()
  for (const r of reported) {
    const key = r.locId ?? r.locName ?? `${r.lat},${r.lng}`
    let place = places.get(key)
    if (!place) {
      place = { key, name: r.locName ?? t('scoutingView.placeUnnamed'), lat: typeof r.lat === 'number' ? r.lat : null, lng: typeof r.lng === 'number' ? r.lng : null, latest: r, subId: null, birds: [] }
      places.set(key, place)
    }
    if (!place.subId && r.subId) place.subId = r.subId
    if (!place.birds.some(b => b.code === r.code)) place.birds.push({ code: r.code, name: r.comName ?? r.code, report: r })
  }
  return [...places.values()].sort((a, b) => b.birds.length - a.birds.length || b.latest.obsDt.localeCompare(a.latest.obsDt))
}

const PLACES_SHOWN = 4
const BIRDS_SHOWN = 5

const cardId = (n: number) => `scout-place-${n}`

/** A bird at a place: links to its report like the bird links elsewhere; ✓ only when an eBird reviewer confirmed it. */
const BirdChip = ({ bird }: { bird: PlaceBird }) => {
  const confirmed = bird.report.confirmed
  const label = confirmed === true ? `${bird.name}: ${t('evidence.confirmed')}` : confirmed === false ? t('scoutingView.unconfirmed', { name: bird.name }) : bird.name
  const inner = (
    <>
      {bird.name}
      {confirmed === true && <><span className='event-scouting__ok' aria-hidden='true'>✓</span><span className='visually-hidden'>{t('evidence.confirmed')}</span></>}
      {confirmed === false && <span className='visually-hidden'>{t('evidence.unconfirmedShort')}</span>}
    </>
  )
  const className = `event-scouting__bird ${confirmed === false ? 'event-scouting__bird--unconfirmed' : ''}`
  return bird.report.subId
    ? <Link className={className} to={`/sighting/${bird.code}/${bird.report.subId}`} title={label}>{inner}</Link>
    : <span className={className} title={label}>{inner}</span>
}

const PlaceCard = ({ place, n, active, open, onOpen, lifers }: { place: Place; n: number; active: boolean; open: boolean; onOpen: () => void; lifers: boolean }) => {
  const extra = place.birds.length - BIRDS_SHOWN
  const birds = open || extra <= 1 ? place.birds : place.birds.slice(0, BIRDS_SHOWN)
  return (
    <li id={cardId(n)} className={`event-scouting__place ${active ? 'is-active' : ''}`} data-testid='scout-place'>
      <p className='event-scouting__place-head'>
        <span className='event-scouting__num' aria-hidden='true'>{n}</span>
        <strong className='event-scouting__place-name'>{place.name}</strong>
        <span className='event-scouting__when'>{whenAgo(place.latest.obsDt)}</span>
      </p>
      <p className='event-scouting__count'><strong>{t(lifers ? 'scoutingView.lifersHere' : 'scoutingView.targetsHere', { count: place.birds.length })}</strong></p>
      <ul className='event-scouting__birds'>
        {birds.map(bird => <li key={bird.code}><BirdChip bird={bird} /></li>)}
        {birds.length < place.birds.length && (
          <li><button type='button' className='event-scouting__bird event-scouting__more' aria-label={t('scoutingView.moreBirdsLabel', { count: extra, place: place.name })} onClick={onOpen}>{t('scoutingView.moreBirds', { count: extra })}</button></li>
        )}
      </ul>
      {place.subId && <a className='event-scouting__checklist' href={`https://ebird.org/checklist/${place.subId}`} target='_blank' rel='noreferrer'>{t('scoutingView.checklist')}</a>}
    </li>
  )
}

/**
 * Where an event's target birds have been reported lately in its area, and which haven't been: the
 * morning scouting report, any time. A summary, a map of numbered places, a card per place (most
 * targets first) and the birds still missing. With no targets picked, the likely lifers stand in.
 */
const EventScouting = ({ event }: { event: GroupEvent }) => {
  const scouting = useEventScoutingQuery(event.id)
  const data = scouting.data
  const lifers = data?.using === 'likely_lifers'
  const places = useMemo(() => groupByPlace(data?.reported ?? []), [data?.reported])
  const [showAll, setShowAll] = useState(false)
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const [active, setActive] = useState<string | null>(null)
  // A tapped pin: bring its card into view once it has rendered (it may have been behind "Show more").
  // Each tap is a new object, so tapping the same pin again scrolls again.
  const [scrollTo, setScrollTo] = useState<{ n: number } | null>(null)
  useEffect(() => {
    if (scrollTo) document.getElementById(cardId(scrollTo.n))?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [scrollTo])

  const points: MapPoint[] = places
    .map((place, i) => ({ place, n: i + 1 }))
    .filter(({ place }) => place.lat !== null && place.lng !== null)
    .map(({ place, n }) => ({
      id: place.key, n, lat: place.lat as number, lng: place.lng as number, title: `${n}. ${place.name}`,
      subtitle: [t(lifers ? 'scoutingView.lifersHere' : 'scoutingView.targetsHere', { count: place.birds.length }), whenAgo(place.latest.obsDt)].join(' · '),
      highlight: place.key === active
    }))
  const pick = (key: string) => {
    const index = places.findIndex(p => p.key === key)
    if (index < 0) return
    setActive(key)
    setOpened(prev => new Set(prev).add(key))
    if (index >= PLACES_SHOWN) setShowAll(true)
    setScrollTo({ n: index + 1 })
  }

  const got = new Set((data?.reported ?? []).map(r => r.code)).size
  const total = got + new Set((data?.unreported ?? []).map(u => u.code)).size
  const head = [
    t('scoutingView.title'),
    typeof data?.days_to_go === 'number' && data.days_to_go > 0 ? t('scoutingView.daysToGo', { count: data.days_to_go }) : null
  ].filter(Boolean).join(' · ')
  const shown = showAll ? places : places.slice(0, PLACES_SHOWN)

  return (
    <div className='event-page__section event-scouting' data-testid='event-scouting'>
      <p className='place__heading'>{head}</p>
      {scouting.isPending && <LoadingState variant='inline' label={t('scoutingView.loading')} />}
      {scouting.isError && <p className='notification__hint'>{t('scoutingView.failed')}</p>}
      {data && (
        <>
          {lifers && <p className='notification__hint event-scouting__fallback'>{t('scoutingView.fallback')}</p>}
          {total > 0 && (
            <div className='event-scouting__summary'>
              <div className='event-scouting__bar' aria-hidden='true'><span style={{ width: `${Math.round((got / total) * 100)}%` }} /></div>
              <p className='event-scouting__progress'>
                <Trans i18nKey={lifers ? 'scoutingView.progressLifers' : 'scoutingView.progress'} count={total} values={{ got, count: total }} components={{ b: <strong /> }} />
              </p>
            </div>
          )}
          {data.checked_at && <p className='event-scouting__updated'>{t('scoutingView.updated', { time: clockTime(new Date(data.checked_at)) })}</p>}
          {points.length > 0 && (
            <div className='event-scouting__map'>
              <SightingsMap points={points} height={240} ariaLabel={t('scoutingView.map', { name: event.name })} onPinClick={pts => pts[0] && pick(pts[0].id)} />
            </div>
          )}
          {places.length
            ? <ol className='event-scouting__places'>
                {shown.map((place, i) => (
                  <PlaceCard key={place.key} place={place} n={i + 1} lifers={lifers} active={place.key === active} open={opened.has(place.key)}
                    onOpen={() => setOpened(prev => new Set(prev).add(place.key))} />
                ))}
              </ol>
            : <p className='notification__hint'>{t(lifers ? 'scoutingView.noneLifers' : 'scoutingView.none')}</p>}
          {places.length > shown.length && (
            <button type='button' className='pill-button pill-button--small event-scouting__more-places' onClick={() => setShowAll(true)}>
              {t('scoutingView.morePlaces', { count: places.length - shown.length })}
            </button>
          )}
          {data.unreported.length > 0 && (
            <div className='event-scouting__missing'>
              <p className='place__subheading'>{t('scoutingView.missing')}</p>
              <p className='event-scouting__missing-hint'>{t('scoutingView.missingHint')}</p>
              <ul className='event-scouting__birds'>
                {data.unreported.map(u => <li key={u.code}><span className='event-scouting__bird event-scouting__bird--missing'>{u.comName ?? u.code}</span></li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default EventScouting
