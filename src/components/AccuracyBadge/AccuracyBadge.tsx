import { useEffect, useRef } from 'react'
import type { BandGrade, PlaceBand } from '../../types'
import './AccuracyBadge.css'

const BANDS: [PlaceBand, string][] = [['High', '60% or better'], ['Good', '40–59%'], ['Fair', '20–39%']]

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
      <summary className='accuracy__badge'>✓ Checked against real reports</summary>
      <div className='accuracy__panel'>
        <p>Every day the app writes down its chances, then checks the next checklist someone files at that place: was the bird on it?</p>
        <ul>
          {rows.map(([band, range]) => {
            const g = grades[band]!
            return <li key={band}>When it said <strong>{range}</strong>, the next visit found the bird <strong>{g.rate}%</strong> of the time <span>({g.n} predictions)</span></li>
          })}
        </ul>
        <p className='accuracy__foot'>Over the last two months in this county.</p>
      </div>
    </details>
  )
}

export default AccuracyBadge
