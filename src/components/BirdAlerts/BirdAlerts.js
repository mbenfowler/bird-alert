import { useEffect, useContext } from "react"
import { Link } from "react-router-dom"
import { nanoid } from 'nanoid'
import BirdsContext from "../BirdsContext/BirdsContext"
import AlertCard from "../AlertCard/AlertCard"
import './BirdAlerts.css'

const BirdAlerts = () => {
    const { birdAlerts } = useContext(BirdsContext)

    useEffect(() => {
    }, [birdAlerts])

    const alerts = birdAlerts.map(alert => {
      return (
        <Link key={nanoid()} to={`https://www.google.com/maps?q=${alert.lat},${alert.lng}&label=${alert.comName}`} target="_blank">
          <AlertCard alert={alert} />
        </Link>
      )
    })
    
    if (!birdAlerts.length) {
        return (
            <div className='alerts-header-box' id='alertsDontExist'>
                <h2 className='alerts-header'>No alerts in your area.</h2>
            </div>
        )
    } else {
        return (
          <div id='birdAlerts'>
              <div className='alerts-header-box' id='alertsExist'>
                <h2 className='alerts-header'>Alerts:</h2>
              </div>
              {alerts}
          </div>
      )
    }
}

export default BirdAlerts
