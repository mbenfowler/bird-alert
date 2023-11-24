import './AlertCard.css'

const AlertCard = ({ alert }) => {
  return (
    <div className="card alert-card">
      <h3>{alert.comName}</h3>
      <p>{alert.obsDt}</p>
      <p>{alert.locName}</p>
    </div>
  )
}

export default AlertCard
