import { useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import AreaPicker, { type PickedArea } from '../AreaPicker/AreaPicker'
import { errorMessage } from '../../apiCalls'
import { usePlacesQuery } from '../../hooks/queries'
import { useCreateEventMutation, usePatchEventMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { monthDay, t } from '../../i18n'
import type { EventInput, GroupEvent, Id } from '../../types'
import { DEFAULT_SCOUT_DAYS, SCOUT_DAYS, daysBefore, today } from './events'

/** Where an event is: one of your places (its area, range and targets come along), or any area picked here. */
type Where = { place: Id } | { area: PickedArea } | null

/**
 * An event's plan, new or changed: its name, where (one of your places or any area), one date for a
 * Big Day or a span, and whether to scout its target birds ahead, and how early.
 */
const EventPlan = ({ event, placeId = null, onDone, onCancel }: { event?: GroupEvent; placeId?: string | null; onDone: (saved: GroupEvent) => void; onCancel: () => void }) => {
  const places = usePlacesQuery()
  const create = useCreateEventMutation()
  const patch = usePatchEventMutation()
  const preset = placeId ? places.data?.find(p => String(p.id) === placeId) : undefined
  const [name, setName] = useState(event?.name ?? preset?.name ?? '')
  // undefined: as it is (an event being changed); a choice once one is made.
  const [where, setWhere] = useState<Where | undefined>(event ? undefined : (placeId ? { place: placeId } : null))
  const [choosing, setChoosing] = useState(!event && !placeId)
  const [bigDay, setBigDay] = useState(event?.kind === 'bigday')
  const [startsOn, setStartsOn] = useState(event?.starts_on ?? '')
  const [endsOn, setEndsOn] = useState(event?.ends_on ?? '')
  const [scout, setScout] = useState(Boolean(event?.scout))
  const [scoutDays, setScoutDays] = useState(event?.scout_days ?? DEFAULT_SCOUT_DAYS)
  const [problem, setProblem] = useState<string | null>(null)
  const chosenPlace = where && 'place' in where ? places.data?.find(p => String(p.id) === String(where.place)) : undefined
  const area = where && 'area' in where ? where.area : null
  const shownState = chosenPlace?.state ?? area?.state ?? event?.state ?? ''
  const shownLocation = chosenPlace?.location ?? area?.location ?? event?.location ?? ''
  const areaName = useAreaName(shownState, shownLocation)
  const whereText = chosenPlace ? `${chosenPlace.name} · ${areaName}` : (area?.label || (shownLocation ? areaName : ''))

  // Turning Big Day on turns scouting on with the usual lead time, unless scouting is already on:
  // then the lead time chosen stays. Turning it off leaves scouting as it is.
  const toggleBigDay = (on: boolean) => {
    setBigDay(on)
    if (on && !scout) { setScout(true); setScoutDays(DEFAULT_SCOUT_DAYS) }
  }
  const pickPlace = (id: Id) => {
    setWhere({ place: id }); setChoosing(false)
    const place = places.data?.find(p => String(p.id) === String(id))
    if (!name.trim() && place) setName(place.name)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ends = bigDay ? startsOn : endsOn
    // From a place, its name stands in until another is given (the places may load after the form).
    const title = name.trim() || chosenPlace?.name || ''
    if (!title) return setProblem(t('events.pickEventName'))
    if (!event && !where) return setProblem(t('events.pickWhere'))
    if (!startsOn || !ends) return setProblem(t(bigDay ? 'places.pickDate' : 'places.pickDates'))
    if (ends < startsOn) return setProblem(t('events.datesOrder'))
    setProblem(null)
    const plan: EventInput & { starts_on: string; ends_on: string } = { name: title, starts_on: startsOn, ends_on: ends, kind: bigDay ? 'bigday' : 'trip', scout, scout_days: scoutDays }
    const fail = (error: unknown) => setProblem(errorMessage(error))
    if (event) {
      // A place chosen for an event already made brings its area and range; its targets stay the event's own.
      const moved = chosenPlace ? { state: chosenPlace.state, location: chosenPlace.location, range_mi: chosenPlace.range_mi } : area ? { state: area.state, location: area.location } : {}
      patch.mutate({ id: event.id, change: { ...plan, ...moved } }, { onSuccess: (saved) => { toast.success(t('events.saved'), { position: 'bottom-center' }); onDone(saved) }, onError: fail })
    } else {
      const from = where && 'place' in where ? { place_id: chosenPlace?.id ?? where.place } : area ? { state: area.state, location: area.location } : {}
      create.mutate({ ...plan, ...from }, { onSuccess: (saved) => { toast.success(t('events.created'), { position: 'bottom-center' }); onDone(saved) }, onError: fail })
    }
  }
  const pending = create.isPending || patch.isPending
  const minDay = event ? undefined : today()

  return (
    <form className='place-form event-plan' onSubmit={submit} noValidate>
      <label>
        <span className='place-form__label'>{t('events.name')}</span>
        <input type='text' name='name' value={name} maxLength={60} placeholder={chosenPlace?.name ?? t('events.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </label>
      <span className='place-form__label'>{t('events.where')}</span>
      {!choosing && whereText
        ? <p className='place-form__area'><strong data-testid='event-where'>{whereText}</strong> <button type='button' className='link-button link-text' onClick={() => setChoosing(true)}>{t('places.change')}</button></p>
        : <div className='event-plan__where'>
            {(places.data?.length ?? 0) > 0 && (
              <>
                <p className='notification__hint'>{t('events.fromPlace')}</p>
                <ul className='place__chips'>{places.data!.map(place => (
                  <li key={place.id}><button type='button' className='place__chip place__chip--add' onClick={() => pickPlace(place.id)}>{place.name}</button></li>
                ))}</ul>
                <p className='notification__hint'>{t('events.orArea')}</p>
              </>
            )}
            <AreaPicker current={null} onPick={(picked) => { setWhere({ area: picked }); setChoosing(false) }} />
          </div>}
      <label className='place__trip-switch'>
        <input className='switch switch--small' type='checkbox' name='bigday' checked={bigDay} onChange={(e) => toggleBigDay(e.target.checked)} />
        <span><span className='place-form__label'>{t('places.bigDay')}</span> <span className='notification__hint'>{t('places.bigDayHint')}</span></span>
      </label>
      {bigDay
        ? <label><span className='place-form__label'>{t('places.bigDayDate')}</span><input type='date' name='starts_on' value={startsOn} min={minDay} onChange={(e) => setStartsOn(e.target.value)} /></label>
        : <div className='event-plan__dates'>
            <label><span className='place-form__label'>{t('places.starts')}</span><input type='date' name='starts_on' value={startsOn} min={minDay} onChange={(e) => setStartsOn(e.target.value)} /></label>
            <label><span className='place-form__label'>{t('places.ends')}</span><input type='date' name='ends_on' value={endsOn} min={startsOn || minDay} onChange={(e) => setEndsOn(e.target.value)} /></label>
          </div>}
      <label className='place__trip-switch'>
        <input className='switch switch--small' type='checkbox' name='scout' checked={scout} onChange={(e) => setScout(e.target.checked)} />
        <span className='place-form__label'>{t('events.scout')}</span>
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
        <button type='submit' className='pill-button pill-button--primary' disabled={pending}>{event ? t('events.savePlan') : t('events.create')}</button>
        <button type='button' className='link-button link-text' onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

export default EventPlan
