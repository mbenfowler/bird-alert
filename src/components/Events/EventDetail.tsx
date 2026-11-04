import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import { LoadingState } from '../Loading/Loading'
import { LoadProblem, OfflineNote } from '../Offline/Offline'
import { errorMessage } from '../../apiCalls'
import { queryKeys, useBirdsQuery, useEventRecapQuery, useEventScoutingQuery, useEventsQuery } from '../../hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { useEndEventMutation, useEventMemberMutation, useLeaveEventMutation, useRotateInviteMutation, useStartInviteMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { shareUrl } from '../../share'
import { dateRange, monthDay, t } from '../../i18n'
import type { GroupEvent } from '../../types'
import EventPlan from './EventPlan'
import EventScouting from './EventScouting'
import EventTargets from './EventTargets'
import ScoutingToday from './ScoutingToday'
import { showScoutingCard } from './scoutingRows'
import { prefersReducedMotion } from '../../routeDraw'
import EventRoutePanel from './EventRoutePanel'
import DayView, { DayStops, SunLine } from './DayView'
import GetReady from './GetReady'
import { isEventDay, useEventDay } from './useEventDay'
import { safeZone, zonedDay } from './daySchedule'
import { daysBefore, eventPath, isGroup, isPast, isScouting, membersText, recapText, scoutFrom, today } from './events'
import Recap from '../Recap/Recap'
import '../AlertCenter/Places.css'
import './Events.css'

const absolute = (url: string) => (/^https?:/.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`)
const fail = (error: unknown) => toast.error(errorMessage(error), { position: 'bottom-center' })

/**
 * Who's in: just you until you invite anyone. Inviting asks once for the name your group will know
 * you by, then gives two links, each on its own row with what it's for: the invite link (which the
 * organizer can reset) and the view-only page.
 */
const People = ({ event }: { event: GroupEvent }) => {
  const start = useStartInviteMutation()
  const rotate = useRotateInviteMutation()
  const [asking, setAsking] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const organizer = event.role === 'organizer'
  const invite = () => void shareUrl(absolute(event.invite_url!), t('events.inviteTitle', { name: event.name }))
  const reset = () => rotate.mutate(event.id, {
    onSuccess: () => { setResetting(false); toast.success(t('events.resetInviteDone'), { position: 'bottom-center' }) },
    onError: fail
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setProblem(t('events.pickName'))
    setProblem(null)
    start.mutate({ id: event.id, displayName: name.trim() }, {
      onSuccess: () => { setAsking(false); toast.success(t('events.inviteReady'), { position: 'bottom-center' }) },
      onError: (error) => setProblem(errorMessage(error))
    })
  }
  return (
    <div className='event-page__section event-detail__people'>
      <h2 className='place__heading'>{t('events.people')}</h2>
      <p className='event__members'>{event.invite_url || isGroup(event) ? membersText(event.members) : t('events.justYou')}</p>
      {event.invite_url
        ? <>
            <div className='event-link' data-testid='event-invite-link'>
              <h3 className='event-link__title'>{t('events.inviteLink')}</h3>
              <p className='event-link__hint'>{t('events.inviteLinkHint')}</p>
              <p className='place__actions'>
                <button type='button' className='pill-button pill-button--primary pill-button--small' onClick={invite}>{t('events.shareInvite')}</button>
                {organizer && !resetting && <button type='button' className='link-button link-text event-link__reset' onClick={() => setResetting(true)}>{t('events.resetInvite')}</button>}
              </p>
              {organizer && resetting && (
                <p className='place__actions event__confirm' role='alert'>
                  <span>{t('events.resetInviteSure')}</span>
                  <button type='button' className='pill-button pill-button--small' disabled={rotate.isPending} onClick={reset}>{t('events.resetInviteYes')}</button>
                  <button type='button' className='link-button link-text' onClick={() => setResetting(false)}>{t('common.cancel')}</button>
                </p>
              )}
            </div>
            <div className='event-link' data-testid='event-view-link'>
              <h3 className='event-link__title'>{t('events.viewOnly')}</h3>
              <p className='event-link__hint'>{t('events.viewOnlyHint')}</p>
              <p className='place__actions'>
                <button type='button' className='pill-button pill-button--small' disabled={!event.view_url}
                  onClick={() => void shareUrl(absolute(event.view_url!), t('events.viewOnlyTitle', { name: event.name }))}>{t('events.shareViewOnly')}</button>
              </p>
            </div>
          </>
        : asking
          ? <form className='event-share' onSubmit={submit} noValidate>
              <label>
                <span className='place-form__label'>{t('events.yourName')}</span>
                <input type='text' name='display_name' value={name} maxLength={30} autoComplete='given-name' placeholder={t('events.yourNamePlaceholder')} onChange={(e) => setName(e.target.value)} />
              </label>
              {problem && <p className='place-form__error' role='alert'>{problem}</p>}
              <div className='place-form__actions'>
                <button type='submit' className='pill-button pill-button--primary pill-button--small' disabled={start.isPending}>{t('events.inviteGo')}</button>
                <button type='button' className='link-button link-text' onClick={() => { setAsking(false); setProblem(null) }}>{t('common.cancel')}</button>
              </div>
            </form>
          : <>
              <p className='place__actions'>
                <button type='button' className='pill-button pill-button--primary pill-button--small' onClick={() => setAsking(true)}>{t('events.inviteGroup')}</button>
              </p>
              <p className='notification__hint'>{t('events.soloHint')}</p>
            </>}
    </div>
  )
}

/** Archive or unarchive (just for you), leave (members), or delete for everyone (the organizer). */
const Actions = ({ event, onDay }: { event: GroupEvent; onDay: boolean }) => {
  const navigate = useNavigate()
  const member = useEventMemberMutation()
  const leave = useLeaveEventMutation()
  const end = useEndEventMutation()
  const [confirming, setConfirming] = useState(false)
  const organizer = event.role === 'organizer'
  const archive = (archived: boolean) => member.mutate({ id: event.id, change: { archived } }, {
    onSuccess: () => toast.success(archived ? t('events.archivedDone') : t('events.unarchivedDone'), { position: 'bottom-center' }),
    onError: fail
  })
  const gone = (message: string) => () => { toast.success(message, { position: 'bottom-center' }); navigate('/events', { replace: true }) }
  return (
    <div className='event-page__section event-detail__actions'>
      <p className='place__actions'>
        {/* Not put away on the day itself: it would vanish from Events mid-day. */}
        {(!onDay || event.archived) && <button type='button' className='link-button link-text' disabled={member.isPending} onClick={() => archive(!event.archived)}>{event.archived ? t('events.unarchive') : t('events.archive')}</button>}
        {!organizer && <button type='button' className='link-button link-text' disabled={leave.isPending} onClick={() => leave.mutate(event.id, { onSuccess: gone(t('events.left')), onError: fail })}>{t('events.leave')}</button>}
        {organizer && !confirming && <button type='button' className='link-button link-text event__delete' onClick={() => setConfirming(true)}>{t('events.delete')}</button>}
      </p>
      {organizer && confirming && (
        <p className='place__actions event__confirm' role='alert'>
          <span>{t('events.deleteSure')}</span>
          <button type='button' className='pill-button pill-button--small event__delete' disabled={end.isPending} onClick={() => end.mutate(event.id, { onSuccess: gone(t('events.deleted')), onError: fail })}>{t('events.deleteYes')}</button>
          <button type='button' className='link-button link-text' onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
        </p>
      )}
    </div>
  )
}

/**
 * The morning scouting push and email open /events/<id>#scouting: once the card (or, with no card,
 * the scouting details) is on the page, scroll to it (smoothly, unless motion is reduced) and light
 * it up for a moment. Each arrival at the hash counts once, so later renders leave the page alone.
 */
const FLASH_MS = 2400
const useScoutingLink = (id: string, ready: boolean) => {
  const { hash, key } = useLocation()
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (hash !== '#scouting' || !ready || done.current === key) return
    const el = document.getElementById(id)
    if (!el) return
    done.current = key
    el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
    // A data attribute React doesn't manage, so the page's own renders never cut the light short.
    el.setAttribute('data-flash', '')
    window.setTimeout(() => el.removeAttribute('data-flash'), FLASH_MS)
  }, [hash, key, ready, id])
}

/** Within this many days of the start, "Get ready for offline" sits at the top. */
const READY_DAYS = 3

/**
 * One event (/events/:id, where scouting reports and event emails link). On the day it leads with
 * the day itself (the route's current and next stop, the tally, the group log), then the stops with
 * their planned times; in the days before, "Get ready for offline" comes first. Then the plan, its
 * target birds, scouting, who's in, and archiving, leaving or deleting it.
 */
const EventDetail = () => {
  const { id = '' } = useParams()
  // On the day the page follows the tally like the tally page does: every 30 s, and at once when the phone wakes.
  const saved = useQueryClient().getQueryData<GroupEvent[]>(queryKeys.events)?.find(e => String(e.id) === id)
  const events = useEventsQuery(Boolean(saved && isEventDay(saved)))
  const event = events.data?.find(e => String(e.id) === id)
  if (events.isPending) return <LoadingState />
  if (!event) return <section className='event-page'><LoadProblem error={events.error} missing={t('events.tallyMissing')} /><Link to='/events'>{t('events.backToEvents')}</Link></section>
  return <EventBody event={event} updatedAt={events.dataUpdatedAt} error={events.error} />
}

const EventBody = ({ event, updatedAt, error }: { event: GroupEvent; updatedAt: number; error: unknown }) => {
  const areaName = useAreaName(event.state, event.location)
  const [editing, setEditing] = useState(false)
  const past = isPast(event)
  const onDay = isEventDay(event)
  const zone = safeZone(event.timezone)
  const todayThere = zone ? zonedDay(new Date(), zone) : today()
  const soon = !past && !onDay && event.starts_on >= todayThere && daysBefore(event.starts_on, READY_DAYS) <= todayThere
  const showDay = onDay || soon
  const day = useEventDay(event, showDay)
  const nameCodes = [...new Set([...event.tally.map(e => e.code), ...event.targets.map(target => target.code)])].sort()
  const names = useBirdsQuery(showDay ? nameCodes : [])
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName ?? code
  const from = scoutFrom(event)
  const tally = `${eventPath(event.id)}/tally`
  const oneDay = event.kind === 'bigday' || event.starts_on === event.ends_on
  const scouting = useEventScoutingQuery(past ? null : event.id)
  const showCard = showScoutingCard(scouting.data, { past, onDay, scouting: isScouting(event) })
  useScoutingLink(showCard ? 'scouting' : 'scouting-details', !scouting.isPending || !showCard)
  const seeWhere = () => document.getElementById('scouting-details')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  // Once the last day is over (in the event's zone) the server may have its recap: open while fixes
  // are taken, then sealed. While it's live it answers not_ended, and the page stays as it is.
  const over = !event.active && event.ends_on < todayThere
  const recap = useEventRecapQuery(event.id, over || past).data ?? null
  const planning = (
    <>
      {!recap && <p className='event-page__what'>
        {areaName} · {dateRange(event.starts_on, event.ends_on)}
        {onDay && <span className='place__badge'>{t('events.today')}</span>}
        {!past && isScouting(event) && <span className='place__badge place__badge--scouting'>{t('events.scouting')}</span>}
        {event.kind === 'bigday' && <span className='place__badge place__badge--quiet'>{t('events.bigDay')}</span>}
        {event.archived && <span className='place__badge place__badge--quiet'>{t('events.archivedBadge')}</span>}
      </p>}
      {onDay && <DayView event={event} day={day} nameOf={nameOf} />}
      {!onDay && past && !recap && <p className='events-list__recap' data-testid='event-recap'>{recapText(event)}</p>}
      {showCard && <ScoutingToday event={event} onSeeWhere={seeWhere} />}
      {showDay && <GetReady event={event} areaName={areaName} route={day.route} />}
      <div className='event-page__section event-detail__plan'>
        <h2 className='place__heading'>{t('events.plan')}</h2>
        {editing
          ? <EventPlan event={event} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
          : <>
              <p>{event.kind === 'bigday' ? t('events.planBigDay', { date: monthDay(event.starts_on) }) : t('events.planDates', { dates: dateRange(event.starts_on, event.ends_on) })}</p>
              {showDay && oneDay && <SunLine sun={day.sun} timeZone={day.timeZone} />}
              <p className='notification__hint'>{from ? t('events.planScouting', { date: monthDay(from) }) : t('events.planNoScouting')}</p>
              <button type='button' className='link-button link-text' onClick={() => setEditing(true)}>{t('events.changePlan')}</button>
            </>}
      </div>
      {/* The route, open from the start and edited in place (the group's, or the suggestion until anyone changes it). */}
      {!past && <EventRoutePanel event={event} onDay={onDay} />}
      {showDay && <DayStops day={day} onDay={onDay} />}
      <EventTargets event={event} areaName={areaName} />
      {!past && <EventScouting event={event} />}
      <People event={event} />
      {!onDay && (
        <div className='event-page__section'>
          <h2 className='place__heading'>{t('events.tally')}</h2>
          <p className='notification__hint'>{past ? recapText(event) : t('events.tallyLater')}</p>
          <Link className='link-button link-text' to={tally}>{t('events.openTally')}</Link>
        </div>
      )}
      <Actions event={event} onDay={onDay} />
    </>
  )
  return (
    <section className='event-page event-detail' data-event={String(event.id)}>
      <p className='event-detail__back'><Link to='/events'>{t('events.allEvents')}</Link></p>
      {/* With a recap the recap leads (its own heading names the event), and the plan and the day fold away below it. */}
      {!recap && <h1 className='fredericka event-page__title'>{event.name}</h1>}
      <OfflineNote updatedAt={updatedAt} error={error} />
      {recap
        ? <>
            <Recap recap={recap} event={event} />
            <details className='event-detail__folded' data-testid='event-planning'>
              <summary className='place__heading'>{t('recap.planAndDay')}</summary>
              {planning}
            </details>
          </>
        : planning}
    </section>
  )
}

export default EventDetail
