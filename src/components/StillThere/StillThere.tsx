import type { CSSProperties } from 'react'
import { useChaseQuery, useDriveQuery } from '../../hooks/queries'
import { formatObsDt } from '../../format'
import { article, chanceColour } from '../../chance'
import type { Chase, PersistenceClass } from '../../types'
import './StillThere.css'

const VERDICT: Record<Chase['verdict'], string> = {
  fresh: 'Yes, as of the latest checklists',
  likely: 'Likely still there',
  maybe: 'Maybe',
  gone: 'Probably gone',
  unknown: 'No recent reports here'
}

const ago = (hours: number) => hours < 1 ? 'under an hour ago' : hours < 36 ? `${hours} ${hours === 1 ? 'hour' : 'hours'} ago` : `${Math.round(hours / 24)} days ago`
/** "an 83%", "a 2%", and below one percent, "less than a 1%" rather than a flat zero. */
const odds = (n: number) => n < 1 ? 'less than a 1%' : `${article(n)} ${n}%`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * "Still there?" for a bird at one place: when it was last seen, what the checklists filed there
 * since say, and the chance a trip now finds it. With a start point, the drive too.
 */
const StillThere = ({ locId, code, cls, to, from, others }: {
  locId: string | null | undefined
  code: string
  cls?: PersistenceClass
  /** For a bird passing through: the chance of finding one here at all (the where-to-find odds). */
  others?: number
  to: { lat: number; lng: number }
  from?: { lat: number; lng: number } | null
}) => {
  const chase = useChaseQuery(locId, code, cls)
  const drive = useDriveQuery(from ? [from, to] : [], Boolean(from && chase.data))
  if (!locId || chase.isError) return null
  if (chase.isPending) return <div className='still-there is-loading' aria-busy='true'><h3 className='still-there__head'>Still there?</h3><p>Checking the latest checklists…</p></div>
  const c = chase.data
  if (!c?.verdict) return null
  const since = c.missesSince > 0
    ? `${plural(c.missesSince, 'checklist')} since then didn’t have it.`
    : c.foundSince > 0
      ? `It was on ${c.foundSince === c.checkedSince ? `all ${plural(c.checkedSince, 'checklist')}` : `${c.foundSince} of ${plural(c.checkedSince, 'checklist')}`} filed here since the report.`
      : c.checkedSince === 0 && c.lastSeen ? 'No checklists filed here since.' : null
  return (
    <div className={`still-there still-there--${c.verdict}`} style={{ '--still': chanceColour(c.stillThere) } as CSSProperties}>
      <h3 className='still-there__head'>Still there?</h3>
      <p className='still-there__verdict'><strong>{VERDICT[c.verdict]}</strong></p>
      {c.lastSeen && (
        <p className='still-there__detail'>
          Last seen {formatObsDt(c.lastSeen)}{c.hoursAgo !== null ? ` (${ago(c.hoursAgo)})` : ''}. {since}
        </p>
      )}
      {c.lastSeen && (
        <p className='still-there__chance'>
          You have {odds(c.chance)} chance to find it if you go now{drive.data ? `, ${drive.data.minutes} minutes from your start` : ''}.
        </p>
      )}
      {/* A migrant that has moved on can be followed by others of its kind; this one's odds aren't the whole story. */}
      {others !== undefined && others > c.chance && (c.verdict === 'gone' || c.verdict === 'maybe') && (
        <p className='still-there__others'>
          Others are still passing through, though: you have {odds(others)} chance to find one here, going by recent reports.
        </p>
      )}
    </div>
  )
}

export default StillThere
