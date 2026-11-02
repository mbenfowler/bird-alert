import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'react-toastify'
import AreaPicker, { type PickedArea } from '../AreaPicker/AreaPicker'
import BirdPicker from '../WhereToGo/BirdPicker'
import ErrorMessage from '../Error/ErrorMessage'
import { CloseIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useCurrentUser, usePlaceSuggestionsQuery, usePlacesQuery } from '../../hooks/queries'
import { useDeletePlaceMutation, useDeletePlaceTripMutation, usePatchUserMutation, usePlaceTargetsMutation, useSavePlaceMutation, useSavePlaceTripMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { unitFor } from '../../distance'
import { stateName, stateOfRegion } from '../../usStates'
import { dateRange, t } from '../../i18n'
import type { SavedPlace } from '../../types'
import './Places.css'

const MAX_PLACES = 10
const WHOLE_STATE = -1
const RANGES = [0, 15, 30, WHOLE_STATE] as const

const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => dayString(new Date())
const inTwoWeeks = () => { const d = new Date(); d.setDate(d.getDate() + 14); return dayString(d) }

/** "Just my county", "25 km", "All of Colorado": the same choices as home's reach, in the place's own units. */
const rangeLabel = (mi: number, state: string) => mi === 0 ? t('range.justCounty')
  : mi === WHOLE_STATE ? (stateName(state) ? t('range.wholeState', { name: stateName(state) }) : t('range.wholeStateUnnamed'))
  : unitFor(state) === 'km' ? t('range.km', { n: Math.round(mi * 1.609344 / 5) * 5 }) : t('range.mi', { n: mi })

/** Adding a place, or changing one: its name, its area (the same picker as home) and how far its alerts reach. */
const PlaceForm = ({ place, preset, onDone }: { place?: SavedPlace; preset?: { state: string; location: string } | null; onDone: () => void }) => {
  const save = useSavePlaceMutation()
  const start = place ?? preset ?? null
  const [name, setName] = useState(place?.name ?? '')
  const [area, setArea] = useState<PickedArea | null>(start ? { location: start.location, state: start.state, label: '' } : null)
  const [choosing, setChoosing] = useState(!start)
  const [range, setRange] = useState(place?.range_mi ?? 30)
  const [problem, setProblem] = useState<string | null>(null)
  const areaName = useAreaName(area?.state ?? '', area?.location ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setProblem(t('places.pickName'))
    if (!area) return setProblem(t('places.pickArea'))
    setProblem(null)
    save.mutate({ id: place?.id, place: { name: name.trim(), state: area.state, location: area.location, range_mi: range } }, {
      onSuccess: () => { toast.success(t('places.saved'), { position: 'bottom-center' }); onDone() },
      onError: (error) => setProblem(errorMessage(error))
    })
  }

  return (
    <form className='place-form' onSubmit={submit} noValidate>
      <label>
        <span className='place-form__label'>{t('places.name')}</span>
        <input type='text' name='name' value={name} maxLength={40} placeholder={t('places.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </label>
      <span className='place-form__label'>{t('places.where')}</span>
      {area && !choosing
        ? <p className='place-form__area'><strong>{area.label || areaName}</strong> <button type='button' className='link-button link-text' onClick={() => setChoosing(true)}>{t('places.change')}</button></p>
        : <AreaPicker current={null} onPick={(picked) => { setArea(picked); setChoosing(false) }} />}
      <span className='place-form__label' id={`reach-${place?.id ?? 'new'}`}>{t('places.reach')}</span>
      <fieldset className='timing place-form__reach' aria-labelledby={`reach-${place?.id ?? 'new'}`}>
        {RANGES.filter(mi => mi !== WHOLE_STATE || (area?.location ?? '').split('-').length > 2).map(mi => (
          <label key={mi} className={`timing__option ${range === mi ? 'is-selected' : ''}`}>
            <input type='radio' name='place_range' value={mi} checked={range === mi} onChange={() => setRange(mi)} />
            {rangeLabel(mi, area?.state ?? '')}
          </label>
        ))}
      </fieldset>
      {problem && <p className='place-form__error' role='alert'>{problem}</p>}
      <div className='place-form__actions'>
        <button type='submit' className='pill-button pill-button--primary' disabled={save.isPending}>{save.isPending ? t('places.saving') : t('places.save')}</button>
        <button type='button' className='link-button link-text' onClick={onDone}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

/** A place's target birds: chips to remove, a search over the area's birds to add, and suggestions for the next trip. */
const Targets = ({ place, areaName }: { place: SavedPlace; areaName: string }) => {
  const targets = usePlaceTargetsMutation()
  const [adding, setAdding] = useState(false)
  const next = place.trips.filter(trip => trip.ends_on >= today()).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0]
  const from = next ? (next.starts_on > today() ? next.starts_on : today()) : today()
  const to = next ? next.ends_on : inTwoWeeks()
  const suggestions = usePlaceSuggestionsQuery(place.id, from, to)
  const suggested = (suggestions.data ?? []).filter(code => !place.targets.includes(code)).slice(0, 8)
  const names = useBirdsQuery([...place.targets, ...suggested])
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName ?? code
  const setCodes = (codes: string[]) => targets.mutate({ id: place.id, codes }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })

  return (
    <div className='place__section'>
      <p className='place__heading'>{t('places.targets')}</p>
      {place.targets.length
        ? <ul className='place__chips'>{place.targets.map(code => (
            <li key={code} className='place__chip'>{nameOf(code)}
              <button type='button' aria-label={t('places.removeTarget', { name: nameOf(code) })} disabled={targets.isPending} onClick={() => setCodes(place.targets.filter(c => c !== code))}><CloseIcon /></button>
            </li>))}</ul>
        : <p className='notification__hint'>{t('places.targetsNone')}</p>}
      {adding
        ? <div className='place__add-target'>
            <BirdPicker region={place.location} regionName={areaName} onPick={(code) => { if (!place.targets.includes(code)) setCodes([...place.targets, code]); setAdding(false) }} />
            <button type='button' className='link-button link-text' onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </div>
        : <button type='button' className='link-button link-text' onClick={() => setAdding(true)}>{t('places.addTarget')}</button>}
      {suggested.length > 0 && (
        <>
          <p className='place__subheading'>{next ? t('places.suggested') : t('places.suggestedSoon')}</p>
          <ul className='place__chips'>{suggested.map(code => (
            <li key={code}><button type='button' className='place__chip place__chip--add' aria-label={t('places.addSuggestion', { name: nameOf(code) })} disabled={targets.isPending} onClick={() => setCodes([...place.targets, code])}>+ {nameOf(code)}</button></li>
          ))}</ul>
        </>
      )}
    </div>
  )
}

/** A place's trips: dates when it switches on by itself. */
const Trips = ({ place }: { place: SavedPlace }) => {
  const save = useSavePlaceTripMutation()
  const remove = useDeletePlaceTripMutation()
  const [adding, setAdding] = useState(false)
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!startsOn || !endsOn) return setProblem(t('places.pickDates'))
    if (endsOn < startsOn) return setProblem(t('places.datesOrder'))
    setProblem(null)
    save.mutate({ placeId: place.id, starts_on: startsOn, ends_on: endsOn }, {
      onSuccess: () => { toast.success(t('places.tripSaved'), { position: 'bottom-center' }); setAdding(false); setStartsOn(''); setEndsOn('') },
      onError: (error) => setProblem(errorMessage(error))
    })
  }
  const trips = [...place.trips].sort((a, b) => a.starts_on.localeCompare(b.starts_on))
  return (
    <div className='place__section'>
      <p className='place__heading'>{t('places.trips')}</p>
      {trips.length
        ? <ul className='place__trips'>{trips.map(trip => {
            const dates = dateRange(trip.starts_on, trip.ends_on)
            return (
              <li key={trip.id}>
                {dates}{trip.active && <span className='place__badge'>{t('places.tripNow')}</span>}
                <button type='button' className='link-button link-text' aria-label={t('places.deleteTrip', { dates })} disabled={remove.isPending}
                  onClick={() => remove.mutate(trip.id, { onSuccess: () => toast.success(t('places.tripDeleted'), { position: 'bottom-center' }), onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })}>
                  {t('places.delete')}
                </button>
              </li>
            )
          })}</ul>
        : <p className='notification__hint'>{t('places.tripsNone')}</p>}
      {adding
        ? <form className='place__trip-form' onSubmit={submit} noValidate>
            <label><span className='place-form__label'>{t('places.starts')}</span><input type='date' name='starts_on' value={startsOn} min={today()} onChange={(e) => setStartsOn(e.target.value)} /></label>
            <label><span className='place-form__label'>{t('places.ends')}</span><input type='date' name='ends_on' value={endsOn} min={startsOn || today()} onChange={(e) => setEndsOn(e.target.value)} /></label>
            {problem && <p className='place-form__error' role='alert'>{problem}</p>}
            <div className='place-form__actions'>
              <button type='submit' className='pill-button pill-button--primary' disabled={save.isPending}>{t('places.saveTrip')}</button>
              <button type='button' className='link-button link-text' onClick={() => { setAdding(false); setProblem(null) }}>{t('common.cancel')}</button>
            </div>
          </form>
        : <button type='button' className='link-button link-text' onClick={() => setAdding(true)}>{t('places.addTrip')}</button>}
    </div>
  )
}

/** One saved place: where, how far, whether you're there now, its target birds and its trips. */
const PlaceCard = ({ place }: { place: SavedPlace }) => {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const patch = usePatchUserMutation()
  const remove = useDeletePlaceMutation()
  const [editing, setEditing] = useState(false)
  const areaName = useAreaName(place.state, place.location)
  const here = user.activePlace ? String(user.activePlace.id) === String(place.id) : false
  if (editing) return <li className='place'><PlaceForm place={place} onDone={() => setEditing(false)} /></li>
  return (
    <li className={`place ${here ? 'is-here' : ''}`}>
      <p className='place__what'>
        <strong>{place.name}</strong> · {areaName} · {rangeLabel(place.range_mi, place.state)}
        {here && <span className='place__badge'>{t('places.active')}</span>}
      </p>
      <p className='place__actions'>
        {here
          ? <button type='button' className='pill-button pill-button--small' disabled={patch.isPending} onClick={() => patch.mutate({ active_place_id: null })}>{t('places.backHome')}</button>
          : <button type='button' className='pill-button pill-button--small' disabled={patch.isPending} onClick={() => patch.mutate({ active_place_id: place.id }, { onSuccess: () => toast.success(t('places.switched', { name: place.name }), { position: 'bottom-center' }) })}>{t('places.hereNow')}</button>}
        <button type='button' className='link-button link-text' onClick={() => navigate(`/?region=${encodeURIComponent(place.location)}`)}>{t('places.plan')}</button>
        <button type='button' className='link-button link-text' aria-label={t('places.editLabel', { name: place.name })} onClick={() => setEditing(true)}>{t('places.edit')}</button>
        <button type='button' className='link-button link-text' aria-label={t('places.deleteLabel', { name: place.name })} disabled={remove.isPending}
          onClick={() => remove.mutate(place.id, { onSuccess: () => toast.success(t('places.deleted'), { position: 'bottom-center' }), onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })}>
          {t('places.delete')}
        </button>
      </p>
      <Targets place={place} areaName={areaName} />
      <Trips place={place} />
    </li>
  )
}

/**
 * Your places: home, and the places you go besides (a work town, a cabin), each with its own area,
 * reach and target birds. Switch to one when you're there, or give it trip dates and it switches on
 * its own; everything comes back home afterwards. "Save this place" from exploring lands here with
 * the area filled in (?addPlace=US-CO-031).
 */
const Places = () => {
  const user = useCurrentUser()
  const places = usePlacesQuery()
  const patch = usePatchUserMutation()
  const [params, setParams] = useSearchParams()
  const presetRegion = params.get('addPlace')
  const presetState = presetRegion ? stateOfRegion(presetRegion) : null
  const [adding, setAdding] = useState(Boolean(presetState))
  const homeName = useAreaName(user.state, user.location)
  const full = (places.data?.length ?? 0) >= MAX_PLACES

  useEffect(() => {
    if (presetState) document.getElementById('places')?.scrollIntoView({ block: 'start' })
  }, [presetState])
  const doneAdding = () => {
    setAdding(false)
    if (presetRegion) setParams((prev) => { const next = new URLSearchParams(prev); next.delete('addPlace'); return next }, { replace: true })
  }

  return (
    <div className='notification-group places' id='places'>
      <div className='notification'>
        <div className='notification__text'>
          <span className='notification__label'>{t('places.title')}</span>
          <p className='notification__hint'>{t('places.hint')}</p>
        </div>
      </div>
      <div className='places__body'>
        <div className={`place place--home ${user.activePlace ? '' : 'is-here'}`}>
          <p className='place__what'><strong>{t('places.home')}</strong> · {homeName}{!user.activePlace && <span className='place__badge'>{t('places.active')}</span>}</p>
          <p className='notification__hint'>{t('places.homeHint')}</p>
        </div>
        <div className='notification notification--sub places__keep'>
          <div className='notification__text'>
            <label htmlFor='keep_home_alerts'>{t('places.keepHome')}</label>
            <p className='notification__hint'>{t('places.keepHomeHint')}</p>
          </div>
          <div className='notification__controls'>
            <input className='switch switch--small' type='checkbox' id='keep_home_alerts' name='keep_home_alerts' checked={user.keep_home_alerts ?? true} disabled={patch.isPending}
              onChange={(e) => patch.mutate({ keep_home_alerts: e.target.checked }, {
                onSuccess: () => toast.success(t('alertCenter.updated'), { position: 'bottom-center' }),
                onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
              })} />
          </div>
        </div>
        {places.isError && <ErrorMessage networkError={errorMessage(places.error)} />}
        {places.data && places.data.length > 0 && <ul className='places__list'>{places.data.map(place => <PlaceCard key={place.id} place={place} />)}</ul>}
        {adding
          ? <PlaceForm preset={presetState ? { state: presetState, location: presetRegion! } : null} onDone={doneAdding} />
          : full
            ? <p className='notification__hint'>{t('places.max', { count: MAX_PLACES })}</p>
            : <button type='button' className='pill-button places__add' onClick={() => setAdding(true)}>{t('places.add')}</button>}
      </div>
    </div>
  )
}

export default Places
