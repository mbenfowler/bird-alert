import { Link, useParams } from 'react-router'
import { toast } from 'react-toastify'
import { Trans } from 'react-i18next'
import { celebrateLifer } from '../Pop/pop'
import BirdPicker from '../WhereToGo/BirdPicker'
import { CloseIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useEventsQuery, useSeenCodes } from '../../hooks/queries'
import { useEventTallyMutation, useToggleSeenMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { clockTime, t } from '../../i18n'
import { tallyCodes } from './events'
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
  const tallyMutation = useEventTallyMutation()
  const seen = useSeenCodes()
  const toggleSeen = useToggleSeenMutation()
  const event = events.data?.find(e => String(e.id) === id)
  const areaName = useAreaName(event?.state ?? '', event?.location ?? '')
  const codes = event ? tallyCodes(event) : []
  const targetCodes = event?.targets.map(target => target.code) ?? []
  const names = useBirdsQuery([...new Set([...codes, ...targetCodes])])
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName ?? code
  if (events.isPending) return <LoadingState />
  if (!event) return <section className='event-page'><p className='event-page__missing'>{t('events.tallyMissing')}</p><Link to='/settings?tab=places#events'>{t('events.backToPlaces')}</Link></section>

  const got = targetCodes.filter(code => codes.includes(code)).length
  const needed = targetCodes.filter(code => !codes.includes(code))
  const change = (code: string, remove = false) => tallyMutation.mutate({ id: event.id, code, remove }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
  // A bird new to the person who added it: offered for their life list, the same as "Seen it" (and celebrated the same way).
  // Only theirs and only when asked: dismissing changes nothing, and a bird already on the list says nothing.
  const add = (code: string) => {
    if (codes.includes(code)) return
    change(code)
    if (!seen.loaded || seen.codes.has(code)) return
    const name = nameOf(code)
    toast(({ closeToast }) => (
      <span className='lifer-prompt' data-testid='lifer-prompt'>
        <span><Trans i18nKey='events.liferPrompt' values={{ name }} components={{ b: <strong /> }} /></span>
        <button type='button' className='pill-button pill-button--small' onClick={(e) => {
          const el = e.currentTarget
          toggleSeen.mutate({ speciesCode: code, seen: true }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
          celebrateLifer(el, name)
          closeToast()
        }}>{t('events.addToLifeList')}</button>
      </span>
    ), { position: 'bottom-center', autoClose: 8000 })
  }
  const entries = [...event.tally].sort((a, b) => b.added_at.localeCompare(a.added_at))
  return (
    <section className='event-page event-tally'>
      <h1 className='fredericka event-page__title'>{t('events.tallyHeading', { name: event.name })}</h1>
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
            <li key={entry.code}>
              <span className='event-tally__bird'>{nameOf(entry.code)}</span>
              <span className='event-tally__who'>{t('events.tallyBy', { name: entry.added_by_name ?? '', time: clockTime(new Date(entry.added_at)) })}</span>
              <button type='button' className='event-tally__undo' aria-label={t('events.undoLabel', { name: nameOf(entry.code) })} disabled={tallyMutation.isPending} onClick={() => change(entry.code, true)}><CloseIcon /></button>
            </li>))}</ol>
        : <p className='notification__hint'>{t('events.tallyEmpty')}</p>}
      {needed.length > 0 && (
        <div className='event-page__section'>
          <p className='place__heading'>{t('events.stillNeeded')}</p>
          <ul className='place__chips'>{needed.map(code => <li key={code}><button type='button' className='place__chip place__chip--add' onClick={() => add(code)}>+ {nameOf(code)}</button></li>)}</ul>
        </div>
      )}
      <p><Link to='/settings?tab=places#events'>{t('events.backToPlaces')}</Link></p>
    </section>
  )
}

export default EventTally
