import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { t } from '../../i18n'
import { cancelPendingAdd, queueTallyChange, usePendingTally, withPending } from '../../tallySync'
import type { GroupEvent, Recap } from '../../types'
import { fixesDay } from './recapData'

type Candidate = NonNullable<Recap['candidates']>[number]

/** Lower case with the accents gone, so "pic" finds "Pic à ventre roux" and "colibri" finds "Colibrí". */
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * "Fill in the recap", while fixes are open: the birds the group may have seen and not put on the
 * tally (its targets, then what's been reported around), as tick boxes. Ticking adds to the tally
 * and unticking takes off, through the same queue as the day itself, so it works with no signal and
 * nothing is lost. A bird ticked here stays in the list after the recap stops suggesting it.
 */
const FillRecap = ({ event, recap }: { event: GroupEvent; recap: Recap }) => {
  const queryClient = useQueryClient()
  const pending = usePendingTally(event.id)
  const tally = withPending(event.tally ?? [], pending)
  const [ticked, setTicked] = useState<Candidate[]>([])
  const [query, setQuery] = useState('')
  const candidates = recap.candidates ?? []
  const rows = [...ticked.filter(bird => !candidates.some(c => c.speciesCode === bird.speciesCode)), ...candidates]
  const q = plain(query.trim())
  const shown = q ? rows.filter(bird => plain(bird.comName).includes(q)) : rows
  // A late add goes in with the day's last bird, so the curve stays on the day.
  const at = recap.totals.lastBird?.at ?? recap.timeline[recap.timeline.length - 1]?.at
  const toggle = (bird: Candidate, on: boolean) => {
    if (on) {
      setTicked(prev => (prev.some(b => b.speciesCode === bird.speciesCode) ? prev : [bird, ...prev]))
      queueTallyChange(queryClient, { id: event.id, code: bird.speciesCode, by: event.display_name ?? null, ...(at ? { at } : {}) })
      return
    }
    const entry = tally.find(e => e.code === bird.speciesCode)
    if (entry?.pending && entry.clientId) cancelPendingAdd(queryClient, entry.clientId)
    else queueTallyChange(queryClient, { id: event.id, code: bird.speciesCode, remove: true, by: event.display_name ?? null, entry: entry ?? null })
  }
  if (!rows.length) return null
  return (
    <details className='recap-card recap-fill' data-testid='recap-fill'>
      <summary className='recap-fill__summary'>
        <span className='recap__h2'>{t('recap.fillHeading')}</span>
        <span className='recap__aside'>{t('recap.fillHint', { date: recap.fixesUntil ? fixesDay(recap.fixesUntil, recap.event.timezone) : '' })}</span>
      </summary>
      <label className='recap-fill__search'>
        <span className='visually-hidden'>{t('recap.fillSearch')}</span>
        <input type='search' value={query} placeholder={t('recap.fillSearch')} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {shown.length
        ? <ul className='recap-fill__list'>
            {shown.map(bird => {
              const entry = tally.find(e => e.code === bird.speciesCode)
              return (
                <li key={bird.speciesCode}>
                  <label className='recap-fill__row'>
                    <input type='checkbox' checked={Boolean(entry)} onChange={(e) => toggle(bird, e.target.checked)} />
                    <span>{bird.comName}</span>
                    {entry?.pending && <span className='recap-fill__waiting'>{t('recap.fillWaiting')}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        : <p className='notification__hint'>{t('recap.fillNone')}</p>}
    </details>
  )
}

export default FillRecap
