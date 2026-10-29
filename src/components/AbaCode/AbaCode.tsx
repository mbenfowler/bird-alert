import { useEffect, useRef } from 'react'
import './AbaCode.css'

// Plain words, not the ABA's own labels (Rare, Casual, Accidental): read cold, "casual" sounds
// commoner than "rare" when it's the rarer of the two.
const WORDS: Record<number, string> = { 3: 'a few each year', 4: 'not every year', 5: 'a few records ever' }
const MEANS: Record<number, string> = {
  3: 'seen in very low numbers, but every year, in the ABA Area (the US, Canada and St. Pierre et Miquelon)',
  4: 'not seen every year in the ABA Area, with six or more records in all',
  5: 'recorded five or fewer times ever in the ABA Area'
}

/**
 * How rare a bird is across the whole ABA Area, from the ABA Checklist's code: shown for codes 3
 * (a few each year), 4 (not every year) and 5 (a few records ever) only, since 1-2 just mean regular. `explain` makes it a
 * tap-to-open note with the ABA's credit (for pages); without it, a plain chip (inside cards and
 * links, where a second control would get in the way).
 */
const AbaCode = ({ code, explain = false }: { code?: number | null; explain?: boolean }) => {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!explain) return
    const close = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [explain])
  if (!code || !WORDS[code]) return null
  const label = `ABA Code ${code} · ${WORDS[code]}`
  if (!explain) return <span className='aba-code' title={`ABA Checklist Code ${code}: ${MEANS[code]}`}>{label}</span>
  return (
    <details className='aba-code-note' ref={ref}>
      <summary className='aba-code'>{label}</summary>
      <div className='aba-code-note__panel'>
        <p><strong>ABA Code {code}:</strong> {MEANS[code]}.</p>
        <p className='aba-code-note__credit'>From the ABA Checklist, used with permission of the American Birding Association.</p>
      </div>
    </details>
  )
}

export default AbaCode
