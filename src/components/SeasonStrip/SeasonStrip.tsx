import type { SeasonMonth } from '../../types'
import './SeasonStrip.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  if (!covered) return <p className='list-note'>We are still collecting a year of reports for {regionName}; check back in a day or two.</p>
  return (
    <figure className='season-strip'>
      <ol className='season-strip__bars' aria-label={`Months ${name} is reported in ${regionName}`}>
        {months.map(({ month, reported, covered }) => {
          const share = covered ? reported / covered : 0
          const label = covered ? `${MONTHS[month - 1]}: reported on ${reported} of ${covered} days` : `${MONTHS[month - 1]}: no history yet`
          return (
            <li key={month} className={`season-strip__month ${month === now ? 'is-now' : ''} ${covered ? '' : 'is-unknown'}`} title={label}>
              <span className='season-strip__bar' style={{ '--share': share } as React.CSSProperties} aria-hidden='true'></span>
              <span className='season-strip__label' aria-hidden='true'>{MONTHS[month - 1][0]}</span>
              <span className='visually-hidden'>{label}</span>
            </li>
          )
        })}
      </ol>
      <figcaption>Share of days with a report in {regionName} over the last 12 months{covered < 12 ? `, ${covered} months on file so far` : ''}.</figcaption>
    </figure>
  )
}

export default SeasonStrip
