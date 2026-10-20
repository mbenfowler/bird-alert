import { useEffect, useContext, useState } from "react"
import BirdsContext from "../BirdsContext/BirdsContext"
import AlertCard from "../AlertCard/AlertCard"
import { getExternalNotableBirds } from "../../apiCalls"
import './BirdAlerts.css'

const BirdAlerts = () => {
    const { user, birdAlerts } = useContext(BirdsContext)
    const [notableBirds, setNotableBirds] = useState([])
    const [alertType, setAlertType] = useState('star')

    useEffect(() => {
      if (!user?.location) return
      let cancelled = false
      getExternalNotableBirds(user.location)
        .then(res => { if (!cancelled) setNotableBirds(res) })
        .catch(err => console.error(err))
      return () => { cancelled = true }
    }, [user?.location])

    if (!birdAlerts.length) {
        return (
            <div className='alerts-header-box' id='alertsDontExist'>
                <h2 className='alerts-header'>No alerts in your area.</h2>
            </div>
        )
    }

    const alerts = (alertType === 'star' ? birdAlerts : notableBirds).map(alert => (
      <a key={`${alert.subId}-${alert.speciesCode}`} href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`} target="_blank" rel="noreferrer">
        <AlertCard alert={alert} />
      </a>
    ))

    return (
      <div id='birdAlerts'>
          <div className='alerts-header-box' id='alertsExist'>
            <div className={`material-symbols-outlined alert-icon ${alertType === 'star' ? 'button-pressed' : ''}`} id='star' role='button' aria-pressed={alertType === 'star'} onClick={() => setAlertType('star')}>grade</div>
            <h2 className='alerts-header'>Alerts:</h2>
            <div className={`material-symbols-outlined alert-icon ${alertType === 'notable' ? 'button-pressed' : ''}`} id='notable' role='button' aria-pressed={alertType === 'notable'} onClick={() => setAlertType('notable')}>crisis_alert</div>
          </div>
          {alerts}
      </div>
    )
}

export default BirdAlerts
