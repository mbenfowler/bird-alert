import type { Observation } from '../../types'
import { formatObsDt } from '../../format'
import { useSessionQuery } from '../../hooks/queries'
import { countryOf } from '../../usStates'
import AbaCode from '../AbaCode/AbaCode'
import Evidence from '../Evidence/Evidence'
import { t } from '../../i18n'
import './AlertCard.css'

interface AlertCardProps {
  alert: Observation
}

/**
 * The card's "heat" is the bird's ABA code: 1 as plain as ever, warming through amber and orange to
 * a slowly pulsing red at 5. A 6 (believed extinct) is set apart, dark with an ember glow and a
 * plain "unconfirmed" line, since such a report is almost always a mistake. Colour is never the only
 * cue: 3-5 carry the ABA chip, 6 its line. Outside the ABA Area (the US and Canada) codes would
 * mislead, so cards there stay plain.
 */
const AlertCard = ({ alert }: AlertCardProps) => {
  const state = useSessionQuery().data?.state
  const inAbaArea = !state || ['US', 'CA'].includes(countryOf(state))
  const aba = inAbaArea && alert.aba && alert.aba >= 1 && alert.aba <= 6 ? alert.aba : undefined
  return (
    <div className="card alert-card" data-aba={aba}>
      <h3>{alert.comName}{aba && aba >= 3 && aba <= 5 ? <> <AbaCode code={aba} /></> : null}</h3>
      {aba === 6 && <p className='alert-card__extinct'>{t('aba.extinct')}</p>}
      <p>{formatObsDt(alert.obsDt)}</p>
      <p>{alert.locName}</p>
      <Evidence evidence={alert.evidence} compact />
    </div>
  )
}

export default AlertCard
