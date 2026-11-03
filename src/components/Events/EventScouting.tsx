import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Trans } from 'react-i18next'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import { LoadingState } from '../Loading/Loading'
import EventRoute, { RouteTotals, type RouteBird } from './EventRoute'
import RouteEditor from '../RouteEditor/RouteEditor'
import { useGroupRoute } from './useGroupRoute'
import { customRoute, speciesByPlace, stayTotal, withStays } from './customRoute'
import { useDriveQuery, useEventRouteQuery, useEventScoutingQuery, useSessionQuery } from '../../hooks/queries'
import { useEventScoutingEmailMutation } from '../../hooks/mutations'
import { toast } from 'react-toastify'
import { ApiError, errorMessage, resendConfirmationEmail } from '../../apiCalls'
import type { PlanPoint } from '../../routePlan'
import { clockTime, daysUntil, t } from '../../i18n'
import { editedAgo } from './editedAgo'
import { prefersReducedMotion } from '../../routeDraw'
import { duration } from '../../duration'
import { shortDistance, useDistanceUnit } from '../../distance'
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

const emailCode = (error: unknown) => {
  const data = error instanceof ApiError && typeof error.data === 'object' && error.data !== null ? error.data as { error?: string; retry_after_min?: number } : null
  return { code: data?.error, retryAfter: data?.retry_after_min }
}

/** What the server said about the last "email me" press, as one short line. An unconfirmed address has its own line. */
const EmailNote = ({ result, error }: { result: { to: string } | undefined; error: unknown }) => {
  if (result) return <span className='event-scouting__email-note' role='status'>{t('scoutingView.emailSent', { to: result.to })}</span>
  if (!error) return null
  const { code, retryAfter } = emailCode(error)
  if (code === 'confirm_email' || code === 'event_over') return null
  const line = code === 'too_many' ? t('scoutingView.emailTooMany', { count: Math.max(1, Math.ceil(Number(retryAfter) || 1)) })
    : code === 'mail_cap' ? t('scoutingView.emailBusy')
      : errorMessage(error)
  return <span className='place-form__error event-scouting__email-note' role='alert'>{line}</span>
}

/** Scouting reports only reach a confirmed address: says so, with a resend, sent the way the confirm nudge sends it. */
const ConfirmLine = () => {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const resend = () => {
    setSending(true)
    resendConfirmationEmail()
      .then(() => setSent(true))
      .catch((error) => toast.error(errorMessage(error), { position: 'bottom-center' }))
      .finally(() => setSending(false))
  }
  if (sent) return <span className='event-scouting__email-note event-scouting__email-note--muted' role='status'>{t('scoutingView.confirmSent')}</span>
  return (
    <span className='event-scouting__email-note event-scouting__email-note--muted event-scouting__confirm' role='status'>
      {t('scoutingView.confirmFirst')}{' '}
      <button type='button' className='link-button link-text' onClick={resend} disabled={sending}>{sending ? t('common.sending') : t('scoutingView.confirmResend')}</button>
    </span>
  )
}

/**
 * Where an event's target birds have been reported lately in its area, and which haven't been: the
 * morning scouting report, any time. A summary, a map of numbered places, a card per place (most
 * targets first) and the birds still missing. With no targets picked, the likely lifers stand in.
 */
const EventScouting = ({ event }: { event: GroupEvent }) => {
  const scouting = useEventScoutingQuery(event.id)
  // Any member can have the report mailed now, even with nothing in it yet; the server says when the event is over.
  const email = useEventScoutingEmailMutation()
  const emailError = emailCode(email.error).code
  const emailOver = emailError === 'event_over'
  const user = useSessionQuery().data
  const unconfirmed = user?.email_confirmed === false || emailError === 'confirm_email'
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
  // The route is only asked for when someone presses Plan a route. The server's plan is the
  // suggestion; the group's own route (and its meeting point) is kept on the event, so every member
  // sees and edits the same one.
  // An email's route button links to /events/<id>#route: the route opens at once (the group's own
  // if it has one, else the suggestion) and comes into view once the scouting has loaded.
  const { hash } = useLocation()
  const wantsRoute = hash === '#route'
  const [routeOpen, setRouteOpen] = useState(wantsRoute)
  const routeAnchor = useRef<HTMLButtonElement>(null)
  const shownRoute = useRef(false)
  const [editing, setEditing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const group = useGroupRoute(event.id, routeOpen, editing)
  const routeQuery = useEventRouteQuery(event.id, routeOpen)
  const suggested = routeOpen ? routeQuery.data : undefined
  const reports = useMemo(() => data?.reported ?? [], [data?.reported])
  const toPoint = (s: { locId: string; locName: string; lat: number; lng: number }): PlanPoint => ({ locId: s.locId || null, name: s.locName, lat: s.lat, lng: s.lng })
  const start = group.current?.start ?? null
  const customStops = group.current?.stops ?? null
  const drivePoints = useMemo(() => [...(start ? [start] : []), ...(customStops ?? [])].map(p => ({ lat: p.lat, lng: p.lng })), [start, customStops])
  const drive = useDriveQuery(drivePoints, routeOpen && customStops !== null)
  // Each stop's time there: the group's minutes, else the suggestion's.
  const shownStops = withStays(customStops ?? (suggested?.stops ?? []).map(toPoint), group.saved?.stops, suggested)
  // Drive times come from /ebird/drive as the stops change; until it answers, the saved record's own.
  const route = !routeOpen ? undefined : customStops !== null
    ? customRoute({ suggested, reported: reports, stops: shownStops, start, drive: drive.data, driveFailed: drive.isError, server: group.unsaved ? null : group.saved })
    : suggested
  const keep = (stops: PlanPoint[]) => stops.map(stop => ({ locId: stop.locId, name: stop.name, lat: stop.lat, lng: stop.lng, stay_min: (stop as { stay_min?: number | null }).stay_min ?? null }))
  const editStops = (stops: PlanPoint[]) => { setPickedExtra(null); group.edit({ start, stops: keep(stops) }) }
  const editStay = (i: number, minutes: number | null) => group.edit({ start, stops: keep(shownStops).map((stop, j) => (j === i ? { ...stop, stay_min: minutes } : stop)) })
  const hasStays = shownStops.some(s => typeof (s.stay_min ?? s.suggested_stay_min) === 'number')
  const unit = useDistanceUnit()
  // The meeting point alone can be saved: the suggestion then starts there.
  const editStart = (next: PlanPoint | null) => group.edit({ start: next ? { name: next.name, lat: next.lat, lng: next.lng } : null, stops: customStops })
  const saved = group.saved
  const heading = customStops !== null
    ? [
        t('eventRoute.groupRoute'),
        saved && saved.version > 0 ? (saved.updated_by_you ? t('eventRoute.editedByYou') : saved.updated_by_name ? t('eventRoute.editedBy', { name: saved.updated_by_name }) : t('eventRoute.editedByMember')) : null,
        saved?.updated_at ? editedAgo(saved.updated_at) : null
      ].filter(Boolean).join(' · ')
    : null
  const resetNow = async () => { if (await group.reset()) { setConfirmReset(false); setEditing(false) } }

  // In the editor: each stop's new birds in visit order; to add, the suggestion's extras and every
  // other place in the scouting list, each with what it would add now.
  const speciesAt = useMemo(() => speciesByPlace(suggested, reports), [suggested, reports])
  const newAt = (() => {
    const covered = new Set<string>()
    return shownStops.map(stop => {
      const fresh = speciesAt(stop.locId).filter(code => !covered.has(code))
      fresh.forEach(code => covered.add(code))
      return fresh.length
    })
  })()
  const coveredNow = new Set(shownStops.flatMap(stop => speciesAt(stop.locId)))
  const candidates = [
    ...(suggested?.extras ?? []).map(toPoint),
    ...(suggested?.stops ?? []).map(toPoint),
    ...places.filter(p => p.lat !== null && p.lng !== null && p.key).map(p => ({ locId: p.key, name: p.name, lat: p.lat as number, lng: p.lng as number }))
  ].filter((p, i, all) => all.findIndex(q => q.locId === p.locId) === i)
  const suggestions = candidates
    .map(point => ({ point, adds: speciesAt(point.locId).filter(code => !coveredNow.has(code)).length }))
    .filter(({ adds }) => adds > 0)
    .sort((a, b) => b.adds - a.adds)
    .map(({ point, adds }) => ({ point, detail: t('eventRoute.extraBirds', { count: adds }) }))

  // A route bird's chip is its place card's chip, so it links to the same report.
  const routeBird = (bird: RouteBird, stop: { locId: string }) => {
    const known = places.find(p => p.key === stop.locId)?.birds.find(b => b.code === bird.code)
      ?? places.flatMap(p => p.birds).find(b => b.code === bird.code)
    return known
      ? <BirdChip bird={known} />
      : <span className='event-scouting__bird'>{bird.comName ?? bird.code}</span>
  }
  const startLabel = start ? start.name : t('eventRoute.meetingPoint')
  const routeOnMap = route && route.stops.length > 0
    ? {
        path: route.geometry,
        stops: route.stops.map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.locName}` })),
        start: route.from ? { ...route.from, label: startLabel } : null
      }
    : null
  // The suggestion's optional stops ride along as small grey pins; tapping one brings its row into view.
  const [pickedExtra, setPickedExtra] = useState<{ i: number } | null>(null)
  const extraPoints: MapPoint[] = (route?.extras ?? []).map((x, i) => ({
    id: `extra-${i}`, lat: x.lat, lng: x.lng, muted: true, title: x.locName,
    subtitle: t('eventRoute.extraBirds', { count: x.new_birds.length })
  }))
  const onPin = (pts: MapPoint[]) => {
    const id = pts[0]?.id
    if (!id) return
    if (routeOpen) { if (id.startsWith('extra-')) setPickedExtra({ i: Number(id.slice(6)) }) } else pick(id)
  }

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
  const hasPlaces = places.length > 0
  useEffect(() => {
    if (!wantsRoute || !routeOpen || !hasPlaces || shownRoute.current || !routeAnchor.current) return
    shownRoute.current = true
    routeAnchor.current.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [wantsRoute, routeOpen, hasPlaces])

  return (
    <div className='event-page__section event-scouting' data-testid='event-scouting'>
      <p className='place__heading'>{head}</p>
      {!emailOver && (
        <p className='place__actions event-scouting__email'>
          <button type='button' className='pill-button pill-button--small' disabled={email.isPending} onClick={() => email.mutate(event.id)}>
            {email.isPending ? t('common.sending') : t('scoutingView.emailNow')}
          </button>
          {!email.isPending && <EmailNote result={email.data} error={email.error} />}
          {unconfirmed && <ConfirmLine />}
        </p>
      )}
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
          {places.length > 0 && (
            <button type='button' ref={routeAnchor} id='route' className='pill-button pill-button--small event-scouting__plan' aria-expanded={routeOpen} onClick={() => { setRouteOpen(open => !open); setEditing(false); setConfirmReset(false); setPickedExtra(null) }}>
              {routeOpen ? t('eventRoute.hide') : t('eventRoute.plan')}
            </button>
          )}
          {points.length > 0 && (
            <div className='event-scouting__map'>
              <SightingsMap points={routeOpen ? extraPoints : points} route={routeOnMap} height={240} ariaLabel={t('scoutingView.map', { name: event.name })} onPinClick={onPin} />
            </div>
          )}
          {routeOpen && (
            <>
              {group.offer && (
                <p className='place__actions event__confirm event-route__offer' role='alert'>
                  <span>{t('eventRoute.offer')}</span>
                  <button type='button' className='pill-button pill-button--small' onClick={group.acceptOffer}>{t('eventRoute.offerSave')}</button>
                  <button type='button' className='link-button link-text' onClick={group.declineOffer}>{t('eventRoute.offerDiscard')}</button>
                </p>
              )}
              {group.note && <p className='notification__hint event-route__changed' role='status'>{group.note.updated_by_name ? t('eventRoute.changedBy', { name: group.note.updated_by_name }) : t('eventRoute.changed')}</p>}
              {group.status !== 'idle' && (
                <p className='event-route__note event-route__save' role='status'>
                  {group.status === 'saving' ? t('eventRoute.saving') : group.status === 'saved' ? t('eventRoute.saved') : t('eventRoute.saveFailed')}
                  {group.status === 'failed' && <> <button type='button' className='link-button link-text' onClick={group.retry}>{t('eventRoute.retry')}</button></>}
                </p>
              )}
              {editing
                ? <div className='go__route is-editing event-route__editor' data-testid='route-editor'>
                    <RouteEditor state={event.state} stops={shownStops} start={start ? { locId: null, ...start } : null} editing
                      arriving={route ? route.stops.map(s => (typeof s.leg_min === 'number' && typeof s.leg_mi === 'number' ? { minutes: s.leg_min, miles: s.leg_mi } : null)) : []}
                      describe={(_stop, i) => <span>{newAt[i] ? t('eventRoute.newBirds', { count: newAt[i] }) : t('eventRoute.noNewBirds')}</span>}
                      suggestions={suggestions} suggestionsLabel={t('eventRoute.addFromList')} custom={customStops !== null}
                      between={route && (
                        <>
                          {hasStays && <RouteTotals drive={route.routed ? route.total_min : null} stay={stayTotal(shownStops)} />}
                          <p className='go__covers'>{t(lifers ? 'eventRoute.coversLifers' : 'eventRoute.covers', { got: route.covered, count: route.reported })}</p>
                        </>
                      )}
                      stays={{ of: (i) => ({ minutes: shownStops[i]?.stay_min ?? null, suggested: shownStops[i]?.suggested_stay_min ?? null }), onChange: editStay }}
                      legLabel={(leg) => t('eventRoute.leg', { time: duration(leg.minutes), distance: shortDistance(leg.miles, unit) })}
                      onStops={editStops} onStart={editStart} onReset={() => setConfirmReset(true)} onDone={() => setEditing(false)}
                      resetLabel={t('eventRoute.backSuggested')} startLabel={t('eventRoute.meetingPoint')} startEmpty={t('eventRoute.noMeetingPoint')} />
                  </div>
                : <EventRoute route={route} pending={customStops === null && routeQuery.isPending} updating={customStops === null ? routeQuery.isPlaceholderData : drive.isPlaceholderData}
                    failed={customStops === null && routeQuery.isError} heading={heading}
                    start={start} lifers={lifers} picked={pickedExtra} renderBird={routeBird}
                    actions={(
                      <>
                        <button type='button' className='pill-button pill-button--small event-route__edit' onClick={() => setEditing(true)}>{t('eventRoute.edit')}</button>
                        {customStops !== null && <button type='button' className='link-button link-text event-route__reset' onClick={() => setConfirmReset(true)}>{t('eventRoute.backSuggested')}</button>}
                      </>
                    )} />}
              {confirmReset && (
                <p className='place__actions event__confirm' role='alert'>
                  <span>{t('eventRoute.resetSure')}</span>
                  <button type='button' className='pill-button pill-button--small' disabled={group.resetting} onClick={() => void resetNow()}>{t('eventRoute.resetYes')}</button>
                  <button type='button' className='link-button link-text' onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
                </p>
              )}
            </>
          )}
          {routeOpen ? null : places.length
            ? <ol className='event-scouting__places'>
                {shown.map((place, i) => (
                  <PlaceCard key={place.key} place={place} n={i + 1} lifers={lifers} active={place.key === active} open={opened.has(place.key)}
                    onOpen={() => setOpened(prev => new Set(prev).add(place.key))} />
                ))}
              </ol>
            : <p className='notification__hint'>{t(lifers ? 'scoutingView.noneLifers' : 'scoutingView.none')}</p>}
          {!routeOpen && places.length > shown.length && (
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
