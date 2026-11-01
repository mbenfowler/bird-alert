import type { CSSProperties } from 'react'
import { useChaseQuery, useDriveQuery } from '../../hooks/queries'
import { formatObsDt } from '../../format'
import { article, chanceColour } from '../../chance'
import type { Chase, PersistenceClass } from '../../types'
import './StillThere.css'
import { t } from '../../i18n'

/** From this many checklists in a row without it, the bird has probably left (the HQ desk uses the same rule). */
const GONE_AFTER_MISSES = 3

const ago = (hours: number) => hours < 1 ? t('still.underHour') : hours < 36 ? t('still.hoursAgo', { count: hours }) : t('still.daysAgo', { count: Math.round(hours / 24) })
/** "an 83%", "a 2%", and below one percent, "less than a 1%" rather than a flat zero. */
const odds = (n: number) => n < 1 ? t('still.lessThanOne') : t('still.odds', { article: article(n), n })

/** The headline, from what the checklists filed since say, and how warm its border reads. */
const headline = (c: Chase): { text: string; warmth: number } => {
  if (!c.lastSeen) return { text: t('still.noRecent'), warmth: 0 }
  if (c.missesSince >= GONE_AFTER_MISSES) return { text: t('still.gone'), warmth: 5 }
  if (c.missesSince > 0) return { text: t('still.notOnLast', { count: c.missesSince }), warmth: 30 }
  if (c.foundSince > 0) return { text: t('still.seenLatest'), warmth: 85 }
  return { text: t('still.noneSince'), warmth: 50 }
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
  if (chase.isPending) return <div className='still-there is-loading' aria-busy='true'><h3 className='still-there__head'>{t('still.title')}</h3><p>{t('still.checking')}</p></div>
  const c = chase.data
  if (!c?.verdict) return null
  const head = headline(c)
  const since = c.missesSince > 0
    ? t('still.missedSince', { count: c.missesSince })
    : c.foundSince > 0
      ? (c.foundSince === c.checkedSince ? t('still.onAll', { count: c.checkedSince }) : t('still.onSome', { found: c.foundSince, count: c.checkedSince }))
      : c.checkedSince === 0 && c.lastSeen ? t('still.noneFiled') : null
  return (
    <div className='still-there' style={{ '--still': chanceColour(head.warmth) } as CSSProperties}>
      <h3 className='still-there__head'>{t('still.title')}</h3>
      <p className='still-there__verdict'><strong>{head.text}</strong></p>
      {c.lastSeen && (
        <p className='still-there__detail'>
          {c.hoursAgo !== null ? t('still.lastSeenAgo', { when: formatObsDt(c.lastSeen), ago: ago(c.hoursAgo) }) : t('still.lastSeen', { when: formatObsDt(c.lastSeen) })} {since}
        </p>
      )}
      {placeChance !== undefined && (
        <p className='still-there__chance'>
          {drive.data ? t('still.chanceDrive', { odds: odds(placeChance), minutes: drive.data.minutes }) : t('still.chance', { odds: odds(placeChance) })}
        </p>
      )}
    </div>
  )
}

export default StillThere
