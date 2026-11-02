import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'react-toastify'
import BirdPicker from '../WhereToGo/BirdPicker'
import ErrorMessage from '../Error/ErrorMessage'
import { CloseIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useEventsQuery } from '../../hooks/queries'
import { useEndEventMutation, useEventTargetsMutation, useLeaveEventMutation, usePatchEventMutation, useRotateInviteMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { shareUrl } from '../../share'
import { dateRange, monthDay, t } from '../../i18n'
import type { GroupEvent } from '../../types'
import { daysBefore, membersText, scoutFrom, today } from './events'
import './Events.css'

const SCOUT_DAYS = [7, 14, 21, 28] as const
const absolute = (url: string) => (/^https?:/.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`)

/** The group's target birds: chips (with whose lifer each would be), add from the area's birds, remove. Anyone in the group can. */
const EventTargets = ({ event, areaName }: { event: GroupEvent; areaName: string }) => {
  const save = useEventTargetsMutation()
  const [adding, setAdding] = useState(false)
  const codes = event.targets.map(target => target.code)
  const names = useBirdsQuery(codes)
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName ?? code
  const setCodes = (next: string[]) => save.mutate({ id: event.id, codes: next }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
  return (
    <div className='place__section'>
      <p className='place__heading'>{t('events.targets')}</p>
      {event.targets.length
        ? <ul className='place__chips'>{event.targets.map(target => (
            <li key={target.code} className='place__chip event__target'>
              <span>{nameOf(target.code)}{target.lifer_for?.length ? <span className='event__lifer'> · {t('events.liferFor', { names: target.lifer_for.join(', ') })}</span> : null}</span>
              <button type='button' aria-label={t('events.removeTarget', { name: nameOf(target.code) })} disabled={save.isPending} onClick={() => setCodes(codes.filter(c => c !== target.code))}><CloseIcon /></button>
            </li>))}</ul>
        : <p className='notification__hint'>{t('events.targetsNone')}</p>}
      {adding
        ? <div className='place__add-target'>
            <BirdPicker region={event.location} regionName={areaName} onPick={(code) => { if (!codes.includes(code)) setCodes([...codes, code]); setAdding(false) }} />
            <button type='button' className='link-button link-text' onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </div>
        : <button type='button' className='link-button link-text' onClick={() => setAdding(true)}>{t('events.addTarget')}</button>}
    </div>
  )
}

/** The event's dates: one day for a Big Day, a span otherwise, and how early scouting starts. Anyone in the group can change them. */
const EventDates = ({ event, onDone }: { event: GroupEvent; onDone: () => void }) => {
  const patch = usePatchEventMutation()
  const [bigDay, setBigDay] = useState(event.kind === 'bigday')
  const [startsOn, setStartsOn] = useState(event.starts_on)
  const [endsOn, setEndsOn] = useState(event.ends_on)
  const [scout, setScout] = useState(Boolean(event.scout))
  const [scoutDays, setScoutDays] = useState(event.scout_days ?? 21)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ends = bigDay ? startsOn : endsOn
    if (!startsOn || !ends) return setProblem(t(bigDay ? 'places.pickDate' : 'places.pickDates'))
    if (ends < startsOn) return setProblem(t('places.datesOrder'))
    setProblem(null)
    patch.mutate({ id: event.id, change: { starts_on: startsOn, ends_on: ends, kind: bigDay ? 'bigday' : 'trip', scout, scout_days: scoutDays } }, {
      onSuccess: () => { toast.success(t('events.saved'), { position: 'bottom-center' }); onDone() },
      onError: (error) => setProblem(errorMessage(error))
    })
  }
  return (
    <form className='place__trip-form' onSubmit={submit} noValidate>
      <label className='place__trip-switch'>
        <input className='switch switch--small' type='checkbox' name='bigday' checked={bigDay} onChange={(e) => setBigDay(e.target.checked)} />
        <span><span className='place-form__label'>{t('places.bigDay')}</span> <span className='notification__hint'>{t('places.bigDayHint')}</span></span>
      </label>
      {bigDay
        ? <label><span className='place-form__label'>{t('places.bigDayDate')}</span><input type='date' name='starts_on' value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></label>
        : <>
            <label><span className='place-form__label'>{t('places.starts')}</span><input type='date' name='starts_on' value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></label>
            <label><span className='place-form__label'>{t('places.ends')}</span><input type='date' name='ends_on' value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} /></label>
          </>}
      <label className='place__trip-switch'>
        <input className='switch switch--small' type='checkbox' name='scout' checked={scout} onChange={(e) => setScout(e.target.checked)} />
        <span className='place-form__label'>{t('places.scout')}</span>
      </label>
      {scout && (
        <>
          <div className='timing place__scout-weeks' role='group' aria-label={t('places.scoutLead')}>
            {SCOUT_DAYS.map(days => (
              <button key={days} type='button' className={`timing__option ${days === scoutDays ? 'is-selected' : ''}`} aria-pressed={days === scoutDays} onClick={() => setScoutDays(days)}>
                {t('places.scoutWeeks', { count: days / 7 })}
              </button>
            ))}
          </div>
          {startsOn && <p className='notification__hint place__scout-hint'>{t('places.scoutHint', { date: monthDay(daysBefore(startsOn, scoutDays)) })}</p>}
        </>
      )}
      {problem && <p className='place-form__error' role='alert'>{problem}</p>}
      <div className='place-form__actions'>
        <button type='submit' className='pill-button pill-button--primary' disabled={patch.isPending}>{t('places.saveTrip')}</button>
        <button type='button' className='link-button link-text' onClick={onDone}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

/** One group event: when and where, who's in, the invite and view-only links, shared targets, and leaving or ending it. */
const EventCard = ({ event }: { event: GroupEvent }) => {
  const areaName = useAreaName(event.state, event.location)
  const rotate = useRotateInviteMutation()
  const leave = useLeaveEventMutation()
  const end = useEndEventMutation()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const organizer = event.role === 'organizer'
  const now = today()
  const from = scoutFrom(event)
  const scouting = from !== null && !event.active && now >= from && now < event.starts_on
  const dates = dateRange(event.starts_on, event.ends_on)
  const fail = (error: unknown) => toast.error(errorMessage(error), { position: 'bottom-center' })
  return (
    <li className={`place event ${event.active ? 'is-here' : ''}`} data-event={String(event.id)}>
      <p className='place__what'>
        <strong>{event.name}</strong> · {areaName} · {dates}
        {event.kind === 'bigday' && <span className='place__badge'>{t('events.bigDay')}</span>}
        {event.active && <span className='place__badge'>{t('events.today')}</span>}
        {scouting && <span className='place__badge place__badge--scouting'>{t('events.scouting')}</span>}
      </p>
      {from && !event.active && <p className='notification__hint'>{t('places.scoutingFrom', { date: monthDay(from) })}</p>}
      <p className='event__members'>{membersText(event.members)}</p>
      <p className='place__actions'>
        {event.active && <Link className='pill-button pill-button--primary pill-button--small' to={`/events/${encodeURIComponent(String(event.id))}/tally`}>{t('events.openTally')}</Link>}
        {event.invite_url && <button type='button' className='pill-button pill-button--small' onClick={() => void shareUrl(absolute(event.invite_url!), t('events.inviteTitle', { name: event.name }))}>{t('events.invite')}</button>}
        {organizer && <button type='button' className='link-button link-text' disabled={rotate.isPending}
          onClick={() => rotate.mutate(event.id, { onSuccess: () => toast.success(t('events.newInviteDone'), { position: 'bottom-center' }), onError: fail })}>{t('events.newInvite')}</button>}
        <button type='button' className='link-button link-text' onClick={() => setEditing(e => !e)}>{t('events.editDates')}</button>
      </p>
      {event.view_url && (
        <p className='event__view-only'>
          <button type='button' className='link-button link-text' onClick={() => void shareUrl(absolute(event.view_url!), t('events.viewOnlyTitle', { name: event.name }))}>{t('events.viewOnly')}</button>
          <span className='notification__hint'> {t('events.viewOnlyHint')}</span>
        </p>
      )}
      {editing && <EventDates event={event} onDone={() => setEditing(false)} />}
      <EventTargets event={event} areaName={areaName} />
      <p className='place__actions event__leave'>
        {confirming
          ? <>
              <span>{organizer ? t('events.endSure', { name: event.name }) : t('events.leaveSure', { name: event.name })}</span>
              <button type='button' className='link-button link-text' disabled={leave.isPending || end.isPending}
                onClick={() => (organizer
                  ? end.mutate(event.id, { onSuccess: () => toast.success(t('events.ended'), { position: 'bottom-center' }), onError: fail })
                  : leave.mutate(event.id, { onSuccess: () => toast.success(t('events.left'), { position: 'bottom-center' }), onError: fail }))}>{t('events.yes')}</button>
              <button type='button' className='link-button link-text' onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
            </>
          : <button type='button' className='link-button link-text' onClick={() => setConfirming(true)}>{organizer ? t('events.end') : t('events.leave')}</button>}
      </p>
    </li>
  )
}

/** Group events in Places: trips shared with friends. Nothing shows until there is one. */
const GroupEvents = () => {
  const events = useEventsQuery()
  // Just joined (/settings?tab=places#events): bring the events into view once they've loaded.
  const loaded = Boolean(events.data?.length)
  useEffect(() => {
    if (loaded && window.location.hash.startsWith('#events')) document.getElementById('events')?.scrollIntoView({ block: 'start' })
  }, [loaded])
  if (events.isError) return <ErrorMessage networkError={errorMessage(events.error)} />
  if (!events.data?.length) return null
  return (
    <div className='events' id='events'>
      <p className='place__heading events__heading'>{t('events.heading')}</p>
      <p className='notification__hint'>{t('events.hint')}</p>
      <ul className='places__list'>{events.data.map(event => <EventCard key={event.id} event={event} />)}</ul>
    </div>
  )
}

export default GroupEvents
