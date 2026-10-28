import type { Observation } from '../../types'
import { formatObsDt } from '../../format'
import AbaCode from '../AbaCode/AbaCode'
import './AlertCard.css'

interface AlertCardProps {
  alert: Observation
}

const AlertCard = ({ alert }: AlertCardProps) => (
  <div className="card alert-card">
    <h3>{alert.comName}{alert.aba && alert.aba >= 3 && alert.aba <= 5 ? <> <AbaCode code={alert.aba} /></> : null}</h3>
    <p>{formatObsDt(alert.obsDt)}</p>
    <p>{alert.locName}</p>
  </div>
)

export default AlertCard
