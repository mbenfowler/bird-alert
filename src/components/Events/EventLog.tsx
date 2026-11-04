import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ClockIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { LoadProblem, OfflineNote } from '../Offline/Offline'
import { useBirdsQuery, useEventLogQuery, useEventsQuery } from '../../hooks/queries'
import { clockTimeIn, t } from '../../i18n'
import { queueTallyChange, usePendingTally, withPending } from '../../tallySync'
import type { Bird, GroupEvent } from '../../types'
import { groupLog, notOnMyChecklist, safeZone } from './daySchedule'
import { eventPath } from './events'
import { isEventDay } from './useEventDay'
import '../AlertCenter/Places.css'
import './Events.css'

/**
 * The day's log (/events/:id/log): every bird in the order it was seen, who saw it and near which
 * stop, and for whoever keeps the group's eBird checklist, the birds others found that aren't on it
 * yet, each ticked off with one tap. Works from what's saved on the phone with no signal; ticks wait
 * in the tally's queue like an add.
 */
const EventLog = () => {
  const { id = '' } = useParams()
  const events = useEventsQuery(true)
  const event = events.data?.find(e => String(e.id) === id)
  const log = useEventLogQuery(event?.id ?? id, Boolean(event), Boolean(event && isEventDay(event)))
  const pending = usePendingTally(event?.id)
  const shown = event ? withPending(event.tally, pending) : []
  const queryClient = useQueryClient()
  const codes = [...new Set([...shown.map(e => e.code), ...(event?.targets.map(target => target.code) ?? [])])].sort()
  const names = useBirdsQuery(codes)
  const [tab, setTab] = useState<'log' | 'checklist'>('log')
  if (events.isPending) return <LoadingState />
  if (!event) return <section className='event-page'><LoadProblem error={events.error} missing={t('events.tallyMissing')} /><Link to='/events'>{t('events.backToEvents')}</Link></section>

  const timeZone = safeZone(event.timezone)
  const nameOf = (code: string, given?: string | null) => given
    ?? names.data?.find(b => b.speciesCode === code)?.comName
    ?? queryClient.getQueriesData<Bird[]>({ queryKey: ['birds'] }).flatMap(([, birds]) => (Array.isArray(birds) ? birds : [])).find(b => b.speciesCode === code)?.comName
    ?? code
  const rows = groupLog(log.data, shown)
  const toDo = notOnMyChecklist(shown)
  const done = shown.filter(entry => !entry.added_by_you && entry.marked_by_me && entry.id !== undefined)
  const mark = (entry: GroupEvent['tally'][number], on: boolean) => queueTallyChange(queryClient, { id: event.id, code: entry.code, op: on ? 'mark' : 'unmark', tallyId: entry.id })
  const who = (row: { you: boolean; by: string | null }) => (row.you ? t('events.you') : row.by || t('eventLog.someone'))

  return (
    <section className='event-page event-log'>
      <p className='event-detail__back'><Link to={eventPath(event.id)}>{t('events.backToEvent')}</Link></p>
      <h1 className='fredericka event-page__title'>{t('eventLog.heading', { name: event.name })}</h1>
      <OfflineNote updatedAt={events.dataUpdatedAt} error={events.error} />
      <p className='place__actions event-log__tabs' role='tablist'>
        <button type='button' role='tab' aria-selected={tab === 'log'} className={`pill-button pill-button--small ${tab === 'log' ? 'pill-button--primary' : ''}`} onClick={() => setTab('log')}>{t('eventLog.logTab')}</button>
        <button type='button' role='tab' aria-selected={tab === 'checklist'} className={`pill-button pill-button--small ${tab === 'checklist' ? 'pill-button--primary' : ''}`} onClick={() => setTab('checklist')} data-testid='checklist-tab'>
          {t('eventLog.checklistTab')}
          {toDo.length > 0 && <span className={`place__badge ${tab === 'checklist' ? 'place__badge--quiet' : ''}`}>{toDo.length}</span>}
        </button>
      </p>
      {tab === 'log'
        ? rows.length
          ? <ol className='event-tally__list event-log__list' data-testid='group-log'>
              {rows.map(row => (
                <li key={row.key} className={`${row.removed ? 'is-removed' : ''} ${row.pending ? 'event-tally__entry--pending' : ''}`} data-late={row.late ? 'true' : undefined} data-removed={row.removed ? 'true' : undefined}>
                  <span className='event-log__line'>
                    {[who(row), nameOf(row.code, row.name), clockTimeIn(new Date(row.observedAt), timeZone), row.stopName ? t('eventLog.near', { place: row.stopName }) : null].filter(Boolean).join(' · ')}
                  </span>
                  {row.late && <span className='event-log__late' data-testid='synced-later'>{t('eventLog.syncedLater')}</span>}
                  {row.removed && <span className='event-log__late'>{t('eventLog.removed')}</span>}
                  {row.pending && <span className='event-tally__waiting' title={t('offline.waitingOne')}><ClockIcon /><span className='visually-hidden'>{t('offline.waitingOne')}</span></span>}
                </li>
              ))}
            </ol>
          : <p className='notification__hint'>{t('events.tallyEmpty')}</p>
        : <div data-testid='checklist-keeper'>
            <p className='notification__hint'>{t('eventLog.checklistHint')}</p>
            {toDo.length
              ? <ol className='event-tally__list' data-testid='not-on-checklist'>
                  {toDo.map(entry => (
                    <li key={String(entry.id)}>
                      <span className='event-tally__bird'>{nameOf(entry.code)}</span>
                      <span className='event-tally__who'>{t('events.tallyBy', { name: entry.added_by_name || t('eventLog.someone'), time: clockTimeIn(new Date(entry.observed_at ?? entry.added_at), timeZone) })}</span>
                      <button type='button' className='pill-button pill-button--small' onClick={() => mark(entry, true)} aria-label={t('eventLog.markLabel', { name: nameOf(entry.code) })}>{t('eventLog.mark')}</button>
                    </li>
                  ))}
                </ol>
              : <p className='notification__hint' data-testid='checklist-done'>{t('eventLog.checklistNone')}</p>}
            {done.length > 0 && (
              <>
                <p className='place__subheading'>{t('eventLog.onChecklist', { count: done.length })}</p>
                <ol className='event-tally__list event-tally__list--plain' data-testid='on-checklist'>
                  {done.map(entry => (
                    <li key={String(entry.id)}>
                      <span className='event-tally__bird'>✓ {nameOf(entry.code)}</span>
                      <button type='button' className='link-button link-text' onClick={() => mark(entry, false)} aria-label={t('eventLog.unmarkLabel', { name: nameOf(entry.code) })}>{t('eventLog.unmark')}</button>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>}
      <p><Link to={`${eventPath(event.id)}/tally`}>{t('events.openTally')}</Link></p>
    </section>
  )
}

export default EventLog
