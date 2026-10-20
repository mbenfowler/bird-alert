import type { Observation } from '../../types'
import './AlertCard.css'

interface AlertCardProps {
  alert: Observation
}

const AlertCard = ({ alert }: AlertCardProps) => (
  <div className="card alert-card">
    <h3>{alert.comName}</h3>
    <p>{alert.obsDt}</p>
    <p>{alert.locName}</p>
  </div>
)

export default AlertCard
