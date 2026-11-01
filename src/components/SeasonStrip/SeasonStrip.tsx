import type { SeasonMonth } from '../../types'
import './SeasonStrip.css'
import { shortMonth, t } from '../../i18n'

interface SeasonStripProps {
  months: SeasonMonth[]
  name: string
  regionName: string
}

/**
 * Twelve bars, one per month: the share of days on file with a report of this species in the
 * region. Months we have no history for yet are drawn hollow rather than as zero.
 */
const SeasonStrip = ({ months, name, regionName }: SeasonStripProps) => {
  const now = new Date().getMonth() + 1
  const covered = months.filter(m => m.covered > 0).length
  if (!covered) return <p className='list-note'>{t('season.collecting', { regionName })}</p>
  return (
    <figure className='season-strip'>
      <ol className='season-strip__bars' aria-label={t('season.label', { name, regionName })}>
        {months.map(({ month, reported, covered }) => {
          const share = covered ? reported / covered : 0
          const label = covered ? t('season.month', { month: shortMonth(month), reported, count: covered }) : t('season.monthUnknown', { month: shortMonth(month) })
          return (
            <li key={month} className={`season-strip__month ${month === now ? 'is-now' : ''} ${covered ? '' : 'is-unknown'}`} title={label}>
              <span className='season-strip__bar' style={{ '--share': share } as React.CSSProperties} aria-hidden='true'></span>
              <span className='season-strip__label' aria-hidden='true'>{shortMonth(month)[0]}</span>
              <span className='visually-hidden'>{label}</span>
            </li>
          )
        })}
      </ol>
      <figcaption>{covered < 12 ? t('season.captionPartial', { regionName, count: covered }) : t('season.caption', { regionName })}</figcaption>
    </figure>
  )
}

export default SeasonStrip
