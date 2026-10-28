import type { CSSProperties } from 'react'
import { useChaseQuery, useDriveQuery } from '../../hooks/queries'
import { formatObsDt } from '../../format'
import { article, chanceColour } from '../../chance'
import type { Chase, PersistenceClass } from '../../types'
import './StillThere.css'

/** From this many checklists in a row without it, the bird has probably left (the HQ desk uses the same rule). */
const GONE_AFTER_MISSES = 3

const ago = (hours: number) => hours < 1 ? 'under an hour ago' : hours < 36 ? `${hours} ${hours === 1 ? 'hour' : 'hours'} ago` : `${Math.round(hours / 24)} days ago`
/** "an 83%", "a 2%", and below one percent, "less than a 1%" rather than a flat zero. */
const odds = (n: number) => n < 1 ? 'less than a 1%' : `${article(n)} ${n}%`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The headline, from what the checklists filed since say, and how warm its border reads. */
const headline = (c: Chase): { text: string; warmth: number } => {
  if (!c.lastSeen) return { text: 'No recent reports here', warmth: 0 }
  if (c.missesSince >= GONE_AFTER_MISSES) return { text: 'Probably gone', warmth: 5 }
  if (c.missesSince > 0) return { text: c.missesSince === 1 ? 'Not on the last checklist' : `Not on the last ${c.missesSince} checklists`, warmth: 30 }
  if (c.foundSince > 0) return { text: 'Seen on the latest checklists', warmth: 85 }
  return { text: 'No checklists since', warmth: 50 }
}

/**
 * "Still there?" for a bird at one place: when it was last seen and what the checklists filed
 * there since say. The one chance shown is the place's where-to-find chance (`placeChance`), the
 * number the track record checks; without it (a shared page) the facts stand alone. With a start
 * point, the drive too.
 */
const StillThere = ({ locId, code, cls, to, from, placeChance }: {
  locId: string | null | undefined
  code: string
  cls?: PersistenceClass
  placeChance?: number
  to: { lat: number; lng: number }
  from?: { lat: number; lng: number } | null
}) => {
  const chase = useChaseQuery(locId, code, cls)
  const drive = useDriveQuery(from ? [from, to] : [], Boolean(from && chase.data))
  if (!locId || chase.isError) return null
  if (chase.isPending) return <div className='still-there is-loading' aria-busy='true'><h3 className='still-there__head'>Still there?</h3><p>Checking the latest checklists…</p></div>
  const c = chase.data
  if (!c?.verdict) return null
  const head = headline(c)
  const since = c.missesSince > 0
    ? `${plural(c.missesSince, 'checklist')} since didn’t have it.`
    : c.foundSince > 0
      ? `It was on ${c.foundSince === c.checkedSince ? `all ${plural(c.checkedSince, 'checklist')}` : `${c.foundSince} of ${plural(c.checkedSince, 'checklist')}`} filed here since the report.`
      : c.checkedSince === 0 && c.lastSeen ? 'No checklists filed here since.' : null
  return (
    <div className='still-there' style={{ '--still': chanceColour(head.warmth) } as CSSProperties}>
      <h3 className='still-there__head'>Still there?</h3>
      <p className='still-there__verdict'><strong>{head.text}</strong></p>
      {c.lastSeen && (
        <p className='still-there__detail'>
          Last seen {formatObsDt(c.lastSeen)}{c.hoursAgo !== null ? ` (${ago(c.hoursAgo)})` : ''}. {since}
        </p>
      )}
      {placeChance !== undefined && (
        <p className='still-there__chance'>
          You have {odds(placeChance)} chance to find one here if you go now{drive.data ? `, ${drive.data.minutes} minutes from your start` : ''}.
        </p>
      )}
    </div>
  )
}

export default StillThere
