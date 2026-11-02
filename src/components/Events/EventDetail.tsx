import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import BirdPicker from '../WhereToGo/BirdPicker'
import { CloseIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useEventSuggestionsQuery, useEventsQuery } from '../../hooks/queries'
import { useEndEventMutation, useEventMemberMutation, useEventTargetsMutation, useLeaveEventMutation, useRotateInviteMutation, useStartInviteMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { shareUrl } from '../../share'
import { dateRange, monthDay, t } from '../../i18n'
import type { GroupEvent } from '../../types'
import EventPlan from './EventPlan'
import EventScouting from './EventScouting'
import { MAX_TARGETS, eventPath, isGroup, isPast, isScouting, membersText, recapText, scoutFrom } from './events'
import '../AlertCenter/Places.css'
import './Events.css'

const absolute = (url: string) => (/^https?:/.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`)
const fail = (error: unknown) => toast.error(errorMessage(error), { position: 'bottom-center' })

/**
 * The event's target birds: chips (with whose lifer each would be, once there's a group), a search
 * over the area's birds, suggestions of likely lifers for its dates, and one tap for all of them.
 */
const Targets = ({ event, areaName }: { event: GroupEvent; areaName: string }) => {
  const save = useEventTargetsMutation()
  const [adding, setAdding] = useState(false)
  const codes = event.targets.map(target => target.code)
  // Likely lifers for the area and dates, most likely first: the first few as chips, all of them
  // (as many as the 50 targets have room for) behind one button.
  const lifers = useEventSuggestionsQuery(isPast(event) ? null : event.id, MAX_TARGETS)
  const fresh = (lifers.data ?? []).filter(code => !codes.includes(code))
  const neverSeen = fresh.slice(0, Math.max(0, MAX_TARGETS - codes.length))
  const suggested = fresh.slice(0, 8)
  const names = useBirdsQuery([...codes, ...suggested])
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName ?? code
  const setCodes = (next: string[], done?: () => void) => save.mutate({ id: event.id, codes: next }, { onSuccess: done, onError: fail })
  const group = isGroup(event)
  // Whose lifer each would be: you first (as "you"), then the others the group knows by name.
  const liferFor = (target: GroupEvent['targets'][number]) => [...(target.lifer_for_you ? [t('events.youLower')] : []), ...(target.lifer_for ?? []).filter(n => !target.lifer_for_you || n !== event.display_name)]
  return (
    <div className='event-page__section event-detail__targets' id='event-targets'>
      <h2 className='place__heading'>{t('events.targets')}</h2>
      {event.targets.length
        ? <ul className='place__chips'>{event.targets.map(target => (
            <li key={target.code} className='place__chip event__target'>
              <span>{nameOf(target.code)}{group && liferFor(target).length ? <span className='event__lifer'> · {t('events.liferFor', { names: liferFor(target).join(', ') })}</span> : null}</span>
              <button type='button' aria-label={t('events.removeTarget', { name: nameOf(target.code) })} disabled={save.isPending} onClick={() => setCodes(codes.filter(c => c !== target.code))}><CloseIcon /></button>
            </li>))}</ul>
        : <p className='notification__hint'>{event.scout ? t('events.targetsNoneScout') : t('events.targetsNone')}</p>}
      {adding
        ? <div className='place__add-target'>
            <BirdPicker region={event.location} regionName={areaName} onPick={(code) => { if (!codes.includes(code)) setCodes([...codes, code]); setAdding(false) }} />
            <button type='button' className='link-button link-text' onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </div>
        : <button type='button' className='link-button link-text' onClick={() => setAdding(true)}>{t('events.addTarget')}</button>}
      {suggested.length > 0 && (
        <>
          <p className='place__subheading'>{t('events.suggested')}</p>
          <ul className='place__chips'>{suggested.map(code => (
            <li key={code}><button type='button' className='place__chip place__chip--add' aria-label={t('places.addSuggestion', { name: nameOf(code) })} disabled={save.isPending} onClick={() => setCodes([...codes, code])}>+ {nameOf(code)}</button></li>
          ))}</ul>
        </>
      )}
      {neverSeen.length > 0 && (
        <button type='button' className='pill-button pill-button--small event__add-never-seen' disabled={save.isPending}
          onClick={() => setCodes([...codes, ...neverSeen], () => toast.success(t('events.addedNeverSeen', { count: neverSeen.length }), { position: 'bottom-center' }))}>
          {t('events.addNeverSeen', { count: neverSeen.length })}
        </button>
      )}
    </div>
  )
}

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
const Actions = ({ event }: { event: GroupEvent }) => {
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
        <button type='button' className='link-button link-text' disabled={member.isPending} onClick={() => archive(!event.archived)}>{event.archived ? t('events.unarchive') : t('events.archive')}</button>
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
 * One event (/events/:id, where scouting reports and event emails link): the plan, its target
 * birds, who's in, the tally (up front on the day), and archiving, leaving or deleting it.
 */
const EventDetail = () => {
  const { id = '' } = useParams()
  const events = useEventsQuery()
  const event = events.data?.find(e => String(e.id) === id)
  const areaName = useAreaName(event?.state ?? '', event?.location ?? '')
  const [editing, setEditing] = useState(false)
  if (events.isPending) return <LoadingState />
  if (!event) return <section className='event-page'><p className='event-page__missing'>{t('events.tallyMissing')}</p><Link to='/events'>{t('events.backToEvents')}</Link></section>

  const past = isPast(event)
  const from = scoutFrom(event)
  const tally = `${eventPath(event.id)}/tally`
  return (
    <section className='event-page event-detail' data-event={String(event.id)}>
      <p className='event-detail__back'><Link to='/events'>{t('events.allEvents')}</Link></p>
      <h1 className='fredericka event-page__title'>{event.name}</h1>
      <p className='event-page__what'>
        {areaName} · {dateRange(event.starts_on, event.ends_on)}
        {event.active && <span className='place__badge'>{t('events.today')}</span>}
        {!past && isScouting(event) && <span className='place__badge place__badge--scouting'>{t('events.scouting')}</span>}
        {event.kind === 'bigday' && <span className='place__badge place__badge--quiet'>{t('events.bigDay')}</span>}
        {event.archived && <span className='place__badge place__badge--quiet'>{t('events.archivedBadge')}</span>}
      </p>
      {event.active
        ? <p className='event-detail__tally event-detail__tally--now'><Link className='pill-button pill-button--primary' to={tally}>{t('events.openTally')}</Link></p>
        : past && <p className='events-list__recap' data-testid='event-recap'>{recapText(event)}</p>}
      <div className='event-page__section event-detail__plan'>
        <h2 className='place__heading'>{t('events.plan')}</h2>
        {editing
          ? <EventPlan event={event} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
          : <>
              <p>{event.kind === 'bigday' ? t('events.planBigDay', { date: monthDay(event.starts_on) }) : t('events.planDates', { dates: dateRange(event.starts_on, event.ends_on) })}</p>
              <p className='notification__hint'>{from ? t('events.planScouting', { date: monthDay(from) }) : t('events.planNoScouting')}</p>
              <button type='button' className='link-button link-text' onClick={() => setEditing(true)}>{t('events.changePlan')}</button>
            </>}
      </div>
      <Targets event={event} areaName={areaName} />
      {!past && <EventScouting event={event} />}
      <People event={event} />
      {!event.active && (
        <div className='event-page__section'>
          <h2 className='place__heading'>{t('events.tally')}</h2>
          <p className='notification__hint'>{past ? recapText(event) : t('events.tallyLater')}</p>
          <Link className='link-button link-text' to={tally}>{t('events.openTally')}</Link>
        </div>
      )}
      <Actions event={event} />
    </section>
  )
}

export default EventDetail
