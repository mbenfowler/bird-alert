import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import BirdPicker from '../WhereToGo/BirdPicker'
import AbaCode from '../AbaCode/AbaCode'
import { CloseIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useEventScoutingQuery, useEventSuggestionsQuery } from '../../hooks/queries'
import { useEventTargetsMutation } from '../../hooks/mutations'
import { monthDay, t } from '../../i18n'
import type { GroupEvent } from '../../types'
import { MAX_TARGETS, isGroup, isPast } from './events'
import { filterTargets, reportedLine, sortTargets, targetRows, type TargetFilter, type TargetRow } from './scoutingRows'

const fail = (error: unknown) => toast.error(errorMessage(error), { position: 'bottom-center' })

/** Chips shown before "Show all"; the search box comes with more than this. */
export const TARGETS_SHOWN = 20
/** How long a chip waits for the second tap that removes it. */
const CONFIRM_MS = 4000

const Chip = ({ row, group, youName, confirming, busy, onArm, onRemove }: {
  row: TargetRow; group: boolean; youName: string | null | undefined; confirming: boolean; busy: boolean; onArm: () => void; onRemove: () => void
}) => {
  // Whose lifer each would be: you first (as "you"), then the others the group knows by name.
  const liferFor = [...(row.target.lifer_for_you ? [t('events.youLower')] : []), ...(row.target.lifer_for ?? []).filter(n => !row.target.lifer_for_you || n !== youName)]
  const groupLifer = group && liferFor.length > 0
  const reported = row.status === 'around' ? reportedLine(row, monthDay) : null
  return (
    <li className={`place__chip event__target ${row.status ? `event__target--${row.status}` : ''} ${confirming ? 'is-confirming' : ''}`} data-status={row.status ?? undefined} data-code={row.code} title={reported ?? undefined}>
      {row.got && <span className='event__got' title={t('events.onTally')}><span aria-hidden='true'>✓</span><span className='visually-hidden'>{t('events.onTally')}</span></span>}
      {row.status === 'around' && <span className='event__dot' aria-hidden='true' />}
      <span className='event__target-name'>
        {row.name}
        {reported && <span className='visually-hidden'> · {reported}</span>}
        {row.status === 'missing' && <span className='visually-hidden'> · {t('events.statusMissing')}</span>}
        {groupLifer ? <span className='event__lifer'> · {t('events.liferFor', { names: liferFor.join(', ') })}</span> : null}
      </span>
      {!groupLifer && row.lifer && <span className='event__lifer-mark'>{t('events.liferMark')}</span>}
      {(row.aba ?? 0) >= 3 && <AbaCode code={row.aba} short />}
      {confirming
        ? <button type='button' className='event__remove-yes' aria-label={t('events.removeTargetYes', { name: row.name })} disabled={busy} onClick={onRemove}>{t('events.removeTargetSure')}</button>
        : <button type='button' aria-label={t('events.removeTarget', { name: row.name })} disabled={busy} onClick={onArm}><CloseIcon /></button>}
    </li>
  )
}

/**
 * The event's target birds, most useful first: around this week (newest first), then quiet, then
 * missing, rare birds and lifers first in each. Twenty at a time, a filter by status, a search once
 * the list is long, and the ways to add more. Removing takes a second tap on the same chip.
 */
const EventTargets = ({ event, areaName }: { event: GroupEvent; areaName: string }) => {
  const save = useEventTargetsMutation()
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<TargetFilter>('all')
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const [arming, setArming] = useState<string | null>(null)
  const past = isPast(event)
  const codes = event.targets.map(target => target.code)
  const scouting = useEventScoutingQuery(past ? null : event.id).data
  // Likely lifers for the area and dates, most likely first: the first few as chips, all of them
  // (as many as the 50 targets have room for) behind one button.
  const lifers = useEventSuggestionsQuery(past ? null : event.id, MAX_TARGETS)
  const fresh = (lifers.data ?? []).filter(code => !codes.includes(code))
  const neverSeen = fresh.slice(0, Math.max(0, MAX_TARGETS - codes.length))
  const suggested = fresh.slice(0, 8)
  const names = useBirdsQuery([...codes, ...suggested])
  const nameOf = (code: string) => names.data?.find(b => b.speciesCode === code)?.comName ?? code
  const rows = sortTargets(targetRows(event, scouting, nameOf))
  const known = rows.some(row => row.status)
  const counts = { all: rows.length, around: rows.filter(r => r.status === 'around').length, missing: rows.filter(r => r.status === 'missing').length }
  const searchable = rows.length > TARGETS_SHOWN
  const matching = filterTargets(rows, known ? filter : 'all', searchable ? query : '')
  const shown = all ? matching : matching.slice(0, TARGETS_SHOWN)
  const setCodes = (next: string[], done?: () => void) => save.mutate({ id: event.id, codes: next }, { onSuccess: done, onError: fail })

  // An armed remove goes back to the × on its own after a moment, or on Escape.
  useEffect(() => {
    if (!arming) return
    const timer = window.setTimeout(() => setArming(null), CONFIRM_MS)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setArming(null) }
    document.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKey) }
  }, [arming])

  const filters: { key: TargetFilter; label: string }[] = [
    { key: 'all', label: t('events.filterAll', { count: counts.all }) },
    { key: 'around', label: t('events.filterAround', { count: counts.around }) },
    { key: 'missing', label: t('events.filterMissing', { count: counts.missing }) }
  ]

  return (
    <div className='event-page__section event-detail__targets' id='event-targets'>
      <h2 className='place__heading'>{t('events.targets')}</h2>
      {rows.length > 0 && (known || searchable) && (
        <div className='event-targets__tools'>
          {known && (
            <div className='timing event-targets__filter' role='group' aria-label={t('events.filterLabel')}>
              {filters.map(({ key, label }) => (
                <button key={key} type='button' className={`timing__option ${filter === key ? 'is-selected' : ''}`} aria-pressed={filter === key} onClick={() => { setFilter(key); setAll(false) }}>{label}</button>
              ))}
            </div>
          )}
          {searchable && (
            <input type='search' className='event-targets__search' aria-label={t('events.searchTargets')} placeholder={t('events.searchTargets')} value={query}
              onChange={(e) => { setQuery(e.target.value); setAll(false) }} />
          )}
        </div>
      )}
      {rows.length
        ? <>
            {shown.length > 0
              ? <ul className='place__chips event-targets__chips' data-testid='event-target-chips'>{shown.map(row => (
                  <Chip key={row.code} row={row} group={isGroup(event)} youName={event.display_name} confirming={arming === row.code} busy={save.isPending}
                    onArm={() => setArming(row.code)} onRemove={() => { setArming(null); setCodes(codes.filter(c => c !== row.code)) }} />
                ))}</ul>
              : <p className='notification__hint'>{query.trim() ? t('events.searchNone', { query: query.trim() }) : t('events.filterNone')}</p>}
            {matching.length > TARGETS_SHOWN && (
              <button type='button' className='link-button link-text event-targets__more' aria-expanded={all} onClick={() => setAll(!all)}>
                {all ? t('events.targetsShowFewer') : t('events.targetsShowAll', { count: matching.length })}
              </button>
            )}
          </>
        : <p className='notification__hint'>{event.scout ? t('events.targetsNoneScout') : t('events.targetsNone')}</p>}
      {adding
        ? <div className='place__add-target'>
            <BirdPicker region={event.location} regionName={areaName} onPick={(code) => { if (!codes.includes(code)) setCodes([...codes, code]); setAdding(false) }} />
            <button type='button' className='link-button link-text' onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </div>
        : <p className='place__actions event-targets__add'>
            <button type='button' className='link-button link-text' onClick={() => setAdding(true)}>{t('events.addTarget')}</button>
            {neverSeen.length > 0 && (
              <button type='button' className='pill-button pill-button--small event__add-never-seen' disabled={save.isPending}
                onClick={() => setCodes([...codes, ...neverSeen], () => toast.success(t('events.addedNeverSeen', { count: neverSeen.length }), { position: 'bottom-center' }))}>
                {t('events.addNeverSeen', { count: neverSeen.length })}
              </button>
            )}
          </p>}
      {suggested.length > 0 && (
        <>
          <p className='place__subheading'>{t('events.suggested')}</p>
          <ul className='place__chips'>{suggested.map(code => (
            <li key={code}><button type='button' className='place__chip place__chip--add' aria-label={t('places.addSuggestion', { name: nameOf(code) })} disabled={save.isPending} onClick={() => setCodes([...codes, code])}>+ {nameOf(code)}</button></li>
          ))}</ul>
        </>
      )}
    </div>
  )
}

export default EventTargets
