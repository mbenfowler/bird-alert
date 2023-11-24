import { Link } from "react-router-dom"
import AlertCard from "../AlertCard/AlertCard"
import './BirdAlerts.css'

const BirdAlerts = ({ alerts }) => {
    const birdAlerts = alerts.map(alert => {
      return (
        <Link key={alert.subId} to={`https://www.google.com/maps?q=${alert.lat},${alert.lng}&label=${alert.comName}`} target="_blank">
          <AlertCard alert={alert} />
        </Link>
      )
    })
    
    if (!alerts) {
        return (
            <div>
                <h3>No alerts in your area.</h3>
            </div>
        )
    } else {
        return (
          <div id='birdAlerts'>
              <div id='alertsHeaderBox'>
                <h2 id='alertsHeader'>Alerts:</h2>
              </div>
              {birdAlerts}
          </div>
      )
    }
}

export default BirdAlerts
