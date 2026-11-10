import { Link, useParams } from 'react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Trans } from 'react-i18next'
import { celebrateLifer } from '../Pop/pop'
import BirdPicker from '../WhereToGo/BirdPicker'
import { ClockIcon, CloseIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { LoadProblem, OfflineNote } from '../Offline/Offline'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useEventsQuery, useSeenCodes } from '../../hooks/queries'
import { useToggleSeenMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { clockTimeIn, t } from '../../i18n'
import type { Bird } from '../../types'
import { addLiferAfterSync, cancelPendingAdd, queueTallyChange, undoRemoval, usePendingTally, withPending, type ShownTallyEntry } from '../../tallySync'
import { currentSpot, useTallyLocation } from '../../tallyLocation'
import { safeZone } from './daySchedule'
import { eventPath } from './events'
import '../AlertCenter/Places.css'
import './Events.css'

/**
 * The day's shared tally (/events/:id/tally): a big search to add each bird as it's found, the
 * group's list newest first with who got it, and the count against the targets. Adds show at once;
 * everyone else's arrive with the refresh every 30 seconds.
 */
const EventTally = () => {
  const { id = '' } = useParams()
  const events = useEventsQuery(true)
  const queryClient = useQueryClient()
  const seen = useSeenCodes()
  const toggleSeen = useToggleSeenMutation()
  const event = events.data?.find(e => String(e.id) === id)
  // Changes made here that haven't reached the server (no signal, or still being retried), oldest first.
  const pending = usePendingTally(event?.id ?? id)
  const location = useTallyLocation(Boolean(event))
  const [confirming, setConfirming] = useState<string | null>(null)
  const shown = event ? withPending(event.tally, pending) : []
  const areaName = useAreaName(event?.state ?? '', event?.location ?? '')
  const codes = [...new Set(shown.map(entry => entry.code))]
  const targetCodes = event?.targets.map(target => target.code) ?? []
  // Sorted, so a bird added offline (often a target already named) asks for the same saved list.
  const names = useBirdsQuery([...new Set([...codes, ...targetCodes])].sort())
  // With no signal a new bird's name may only be in another saved list (the picker's, an earlier page's).
  const birdOf = (code: string) => names.data?.find(b => b.speciesCode === code)
    ?? queryClient.getQueriesData<Bird[]>({ queryKey: ['birds'] }).flatMap(([, birds]) => (Array.isArray(birds) ? birds : [])).find(b => b.speciesCode === code)
  const nameOf = (code: string) => birdOf(code)?.comName ?? code
  // A small photo to put a face to the name; with no signal it shows if it was saved, else a blank.
  const photoOf = (code: string) => { const img = birdOf(code)?.birdImg; return img && /^https:\/\//.test(img) ? img : null }
  if (events.isPending) return <LoadingState />
  if (!event) return <section className='event-page'><LoadProblem error={events.error} missing={t('events.tallyMissing')} /><Link to='/events'>{t('events.backToEvents')}</Link></section>

  const got = targetCodes.filter(code => codes.includes(code)).length
  const needed = targetCodes.filter(code => !codes.includes(code))
  const timeZone = safeZone(event.timezone)
  const when = (entry: Pick<ShownTallyEntry, 'observed_at' | 'added_at'>) => clockTimeIn(new Date(entry.observed_at ?? entry.added_at), timeZone)
  const whoWhen = (entry: ShownTallyEntry) => (entry.added_by_you || entry.added_by_name
    ? t('events.tallyBy', { name: entry.added_by_you ? t('events.you') : entry.added_by_name, time: when(entry) })
    : when(entry))
  // Every change waits its turn and is sent when there's signal (src/tallySync.ts); nothing here waits on it.
  // Taking a bird off asks first (it goes for everyone), then offers Undo for a few seconds: the
  // bird comes back as it was, with whoever found it first.
  const remove = (entry: ShownTallyEntry) => {
    setConfirming(null)
    const name = nameOf(entry.code)
    let undo: () => void
    if (entry.pending && entry.clientId) {
      cancelPendingAdd(queryClient, entry.clientId)
      undo = () => { queueTallyChange(queryClient, { id: event.id, code: entry.code, by: entry.added_by_name ?? null, at: entry.added_at, lat: entry.lat, lng: entry.lng }) }
    } else {
      const kept = { ...entry }
      delete kept.pending
      delete kept.clientId
      const removal = queueTallyChange(queryClient, { id: event.id, code: entry.code, remove: true, by: event.display_name ?? null, entry: kept })
      undo = () => undoRemoval(queryClient, removal)
    }
    toast(({ closeToast }) => (
      <span className='lifer-prompt' data-testid='undo-toast'>
        <span>{t('events.removed', { name })}</span>
        <button type='button' className='pill-button pill-button--small' onClick={() => { undo(); closeToast() }}>{t('events.undo')}</button>
      </span>
    ), { position: 'bottom-center', autoClose: 8000 })
  }
  // A bird new to the person who added it: offered for their life list, the same as "Seen it" (and celebrated the same way).
  // Only theirs and only when asked: dismissing changes nothing, and a bird already on the list says nothing.
  // Offered at once, but the life list only gets the bird once the tally has it (never for an add that's dropped).
  const add = (code: string) => {
    const already = shown.find(entry => entry.code === code)
    if (already) {
      toast.info(t('events.alreadyOn', { by: whoWhen(already) }), { position: 'bottom-center', autoClose: 3000 })
      return
    }
    const spot = location.choice === 'yes' ? currentSpot() : null
    const { clientId } = queueTallyChange(queryClient, { id: event.id, code, by: event.display_name ?? null, lat: spot?.lat ?? null, lng: spot?.lng ?? null })
    if (!seen.loaded || seen.codes.has(code)) return
    const name = nameOf(code)
    toast(({ closeToast }) => (
      <span className='lifer-prompt' data-testid='lifer-prompt'>
        <span><Trans i18nKey='events.liferPrompt' values={{ name }} components={{ b: <strong /> }} /></span>
        <button type='button' className='pill-button pill-button--small' onClick={(e) => {
          const el = e.currentTarget
          const kept = addLiferAfterSync(queryClient, clientId, code, () =>
            toggleSeen.mutate({ speciesCode: code, seen: true }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) }))
          if (kept) celebrateLifer(el, name)
          closeToast()
        }}>{t('events.addToLifeList')}</button>
      </span>
    ), { position: 'bottom-center', autoClose: 8000 })
  }
  const entries = [...shown].sort((a, b) => b.added_at.localeCompare(a.added_at))
  return (
    <section className='event-page event-tally'>
      <h1 className='fredericka event-page__title'>{t('events.tallyHeading', { name: event.name })}</h1>
      <OfflineNote updatedAt={events.dataUpdatedAt} error={events.error} />
      <p className='event-tally__count' data-testid='tally-count'>
        <strong>{t('events.tallyCount', { count: codes.length })}</strong>
        {targetCodes.length > 0 && <span> · {t('events.tallyTargets', { got, total: targetCodes.length })}</span>}
      </p>
      {location.choice === null && (
        <p className='place__actions event__confirm event-tally__locate' data-testid='location-ask'>
          <span>{t('events.locationAsk')}</span>
          <button type='button' className='pill-button pill-button--small' onClick={location.allow}>{t('events.locationAllow')}</button>
          <button type='button' className='link-button link-text' onClick={location.decline}>{t('events.locationNo')}</button>
        </p>
      )}
      <div className='event-tally__add'>
        <p className='place-form__label'>{t('events.tallyAdd')}</p>
        <BirdPicker region={event.location} regionName={areaName} placeholder={t('events.tallyPlaceholder')} onPick={add} />
      </div>
      {entries.length
        ? <ol className='event-tally__list'>{entries.map(entry => (
            <li key={entry.code} className={entry.pending ? 'event-tally__entry--pending' : undefined} data-pending={entry.pending ? 'true' : undefined}>
              <Link className='event-tally__link' to={`/sighting/${encodeURIComponent(entry.code)}/latest?region=${encodeURIComponent(event.location)}`}>
                <span className='event-tally__photo' aria-hidden='true'>{photoOf(entry.code) && <img src={photoOf(entry.code)!} alt='' loading='lazy' onError={(e) => { e.currentTarget.hidden = true }} />}</span>
                <span className='event-tally__bird'>{nameOf(entry.code)}</span>
              </Link>
              {entry.pending && <span className='event-tally__waiting' title={t('offline.waitingOne')}><ClockIcon /><span className='visually-hidden'>{t('offline.waitingOne')}</span></span>}
              <span className='event-tally__who'>{whoWhen(entry)}</span>
              {confirming === entry.code
                ? <span className='place__actions event__confirm event-tally__confirm' role='alert'>
                    <span>{t('events.removeSure')}</span>
                    <button type='button' className='pill-button pill-button--small' onClick={() => remove(entry)}>{t('events.removeYes')}</button>
                    <button type='button' className='link-button link-text' onClick={() => setConfirming(null)}>{t('common.cancel')}</button>
                  </span>
                : <button type='button' className='event-tally__undo' aria-label={t('events.undoLabel', { name: nameOf(entry.code) })} onClick={() => setConfirming(entry.code)}><CloseIcon /></button>}
            </li>))}</ol>
        : <p className='notification__hint'>{t('events.tallyEmpty')}</p>}
      {needed.length > 0 && (
        <div className='event-page__section'>
          <p className='place__heading'>{t('events.stillNeeded')}</p>
          <ul className='place__chips'>{needed.map(code => <li key={code}><button type='button' className='place__chip place__chip--add' onClick={() => add(code)}>+ {nameOf(code)}</button></li>)}</ul>
        </div>
      )}
      <p className='place__actions'>
        <Link to={eventPath(event.id)}>{t('events.backToEvent')}</Link>
        <Link to={`${eventPath(event.id)}/log`}>{t('eventDay.groupLog')}</Link>
      </p>
    </section>
  )
}

export default EventTally
