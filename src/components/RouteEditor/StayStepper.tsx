import { useState } from 'react'
import { t } from '../../i18n'
import { duration } from '../../duration'

export const MAX_STAY_MIN = 480
export const STAY_STEP_MIN = 5

/** A stop's time there: the group's own minutes (null: the suggestion's), and the suggestion's, when known. */
export interface Stay { minutes: number | null; suggested: number | null }

/**
 * Every shape a time can take here ("5 min", "45 min", "1 h", "1 h 5 min", "7 h 55 min", "8 h"), in
 * the current language; with tabular numerals the widest of these is the widest of all.
 */
const widest = () => [...new Set([0, 5, 55, 60, 65, 115, 420, 475, MAX_STAY_MIN].map(duration).concat(t('routeTimes.unknown')))]

const clamp = (m: number) => Math.min(MAX_STAY_MIN, Math.max(0, Math.round(m)))

/**
 * How long to spend at a stop: −/+ in 5-minute steps, or tap the time to type it. Shows "suggested"
 * while it follows the suggestion, and "use suggested" to go back once changed.
 */
const StayStepper = ({ name, stay, onChange }: { name: string; stay: Stay; onChange: (minutes: number | null) => void }) => {
  const [typing, setTyping] = useState<string | null>(null)
  const current = stay.minutes ?? stay.suggested
  const base = current ?? 0
  const less = Math.max(0, Math.ceil(base / STAY_STEP_MIN) * STAY_STEP_MIN - STAY_STEP_MIN)
  const more = Math.min(MAX_STAY_MIN, Math.floor(base / STAY_STEP_MIN) * STAY_STEP_MIN + STAY_STEP_MIN)
  const commit = () => {
    const n = Number.parseInt(typing ?? '', 10)
    setTyping(null)
    if (Number.isFinite(n)) onChange(clamp(n))
  }
  const label = current === null ? t('routeTimes.unknown') : duration(current)
  return (
    <div className='go__stay' data-testid='stop-stay'>
      <span className='go__stay-label'>{t('routeTimes.stayLabel')}</span>
      <span className='go__stay-controls'>
        <button type='button' className='go__stay-step' aria-label={t('routeTimes.less', { name })} disabled={current !== null && base <= 0} onClick={() => onChange(less)}>−</button>
        {/* A box as wide as the widest time this language can show, so − and + never move. */}
        <span className='go__stay-box'>
          {widest().map(text => <span key={text} className='go__stay-sizer' aria-hidden='true'>{text}</span>)}
          {typing !== null
            ? <input className='go__stay-input' type='number' inputMode='numeric' min={0} max={MAX_STAY_MIN} step={STAY_STEP_MIN} autoFocus
                aria-label={t('routeTimes.input', { name })} value={typing}
                onChange={(e) => setTyping(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') setTyping(null) }} />
            : <button type='button' className='go__stay-value' aria-label={t('routeTimes.type', { name, time: label })}
                onClick={() => setTyping(String(current ?? ''))}>{label}</button>}
        </span>
        <button type='button' className='go__stay-step' aria-label={t('routeTimes.more', { name })} disabled={base >= MAX_STAY_MIN} onClick={() => onChange(more)}>+</button>
      </span>
      {/* Room for whichever of "suggested" and "use suggested" is wider, so neither shifts the row. */}
      <span className='go__stay-note'>
        <span className={`go__stay-tag ${stay.minutes === null && stay.suggested !== null ? '' : 'is-hidden'}`} aria-hidden={stay.minutes !== null || stay.suggested === null}>{t('routeTimes.suggested')}</span>
        {stay.minutes !== null
          ? <button type='button' className='go__link-button go__stay-reset' onClick={() => onChange(null)}>{t('routeTimes.useSuggested')}</button>
          : <span className='go__link-button go__stay-reset is-hidden' aria-hidden='true'>{t('routeTimes.useSuggested')}</span>}
      </span>
    </div>
  )
}

export default StayStepper
