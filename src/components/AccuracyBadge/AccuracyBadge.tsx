import { useEffect, useRef } from 'react'
import type { BandGrade, PlaceBand } from '../../types'
import './AccuracyBadge.css'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

const BANDS: [PlaceBand, string][] = [['High', 'accuracy.high'], ['Good', 'accuracy.good'], ['Fair', 'accuracy.fair']]

/**
 * A quiet badge saying the chances are checked against what birders go on to report; tapping it
 * (no hover on a phone) opens the track record in plain words. Only shown once a band has been
 * graded enough to say anything.
 */
const AccuracyBadge = ({ grades }: { grades?: Partial<Record<PlaceBand, BandGrade>> }) => {
  const ref = useRef<HTMLDetailsElement>(null)
  // A tap anywhere else closes it.
  useEffect(() => {
    const close = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const rows = BANDS.filter(([band]) => grades?.[band]?.enough && grades[band]!.rate !== null)
  if (!grades || !rows.length) return null
  return (
    <details className='accuracy' ref={ref}>
      <summary className='accuracy__badge'>{t('accuracy.badge')}</summary>
      <div className='accuracy__panel'>
        <p>{t('accuracy.how')}</p>
        <ul>
          {rows.map(([band, range]) => {
            const g = grades[band]!
            return <li key={band}><Trans i18nKey='accuracy.row' values={{ range: t(range), rate: g.rate }} components={{ b: <strong /> }} /> <span>{t('accuracy.predictions', { count: g.n })}</span></li>
          })}
        </ul>
        <p className='accuracy__foot'>{t('accuracy.foot')}</p>
      </div>
    </details>
  )
}

export default AccuracyBadge
