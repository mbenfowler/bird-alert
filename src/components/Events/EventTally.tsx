import { Link, useParams } from 'react-router'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
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
import { clockTime, t } from '../../i18n'
import type { Bird } from '../../types'
import { TALLY_KEY, addLiferAfterSync, cancelPendingAdd, queueTallyChange, withPending, type TallyChange } from '../../tallySync'
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
  const pending = useMutationState({ filters: { mutationKey: TALLY_KEY, status: 'pending' }, select: (m) => m.state.variables as TallyChange })
    .filter(change => change && String(change.id) === id)
  const shown = event ? withPending(event.tally, pending) : []
  const areaName = useAreaName(event?.state ?? '', event?.location ?? '')
  const codes = [...new Set(shown.map(entry => entry.code))]
  const targetCodes = event?.targets.map(target => target.code) ?? []
  // Sorted, so a bird added offline (often a target already named) asks for the same saved list.
  const names = useBirdsQuery([...new Set([...codes, ...targetCodes])].sort())
  // With no signal a new bird's name may only be in another saved list (the picker's, an earlier page's).
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName
    ?? queryClient.getQueriesData<Bird[]>({ queryKey: ['birds'] }).flatMap(([, birds]) => (Array.isArray(birds) ? birds : [])).find(b => b.speciesCode === code)?.comName
    ?? code
  if (events.isPending) return <LoadingState />
  if (!event) return <section className='event-page'><LoadProblem error={events.error} missing={t('events.tallyMissing')} /><Link to='/events'>{t('events.backToEvents')}</Link></section>

  const got = targetCodes.filter(code => codes.includes(code)).length
  const needed = targetCodes.filter(code => !codes.includes(code))
  // Every change waits its turn and is sent when there's signal (src/tallySync.ts); nothing here waits on it.
  const remove = (code: string) => {
    const waiting = shown.find(entry => entry.code === code && entry.pending)
    if (waiting?.clientId) cancelPendingAdd(queryClient, waiting.clientId)
    else queueTallyChange(queryClient, { id: event.id, code, remove: true, by: event.display_name ?? null })
  }
  // A bird new to the person who added it: offered for their life list, the same as "Seen it" (and celebrated the same way).
  // Only theirs and only when asked: dismissing changes nothing, and a bird already on the list says nothing.
  // Offered at once, but the life list only gets the bird once the tally has it (never for an add that's dropped).
  const add = (code: string) => {
    if (codes.includes(code)) return
    const { clientId } = queueTallyChange(queryClient, { id: event.id, code, by: event.display_name ?? null })
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
      <div className='event-tally__add'>
        <p className='place-form__label'>{t('events.tallyAdd')}</p>
        <BirdPicker region={event.location} regionName={areaName} placeholder={t('events.tallyPlaceholder')} onPick={add} />
      </div>
      {entries.length
        ? <ol className='event-tally__list'>{entries.map(entry => (
            <li key={entry.code} className={entry.pending ? 'event-tally__entry--pending' : undefined} data-pending={entry.pending ? 'true' : undefined}>
              <span className='event-tally__bird'>{nameOf(entry.code)}</span>
              {entry.pending && <span className='event-tally__waiting' title={t('offline.waitingOne')}><ClockIcon /><span className='visually-hidden'>{t('offline.waitingOne')}</span></span>}
              <span className='event-tally__who'>{entry.added_by_you || entry.added_by_name ? t('events.tallyBy', { name: entry.added_by_you ? t('events.you') : entry.added_by_name, time: clockTime(new Date(entry.added_at)) }) : clockTime(new Date(entry.added_at))}</span>
              <button type='button' className='event-tally__undo' aria-label={t('events.undoLabel', { name: nameOf(entry.code) })} onClick={() => remove(entry.code)}><CloseIcon /></button>
            </li>))}</ol>
        : <p className='notification__hint'>{t('events.tallyEmpty')}</p>}
      {needed.length > 0 && (
        <div className='event-page__section'>
          <p className='place__heading'>{t('events.stillNeeded')}</p>
          <ul className='place__chips'>{needed.map(code => <li key={code}><button type='button' className='place__chip place__chip--add' onClick={() => add(code)}>+ {nameOf(code)}</button></li>)}</ul>
        </div>
      )}
      <p><Link to={`/events/${encodeURIComponent(String(event.id))}`}>{t('events.backToEvent')}</Link></p>
    </section>
  )
}

export default EventTally
