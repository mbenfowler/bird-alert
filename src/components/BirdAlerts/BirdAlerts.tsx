import { useMemo, useState } from 'react'
import AlertCard from '../AlertCard/AlertCard'
import { useCurrentUser, useNotableQuery, useObservationsQuery, useSavedCodes } from '../../hooks/queries'
import './BirdAlerts.css'

type AlertType = 'star' | 'notable'

const BirdAlerts = () => {
    const user = useCurrentUser()
    const region = user.location
    const [alertType, setAlertType] = useState<AlertType>('star')

    const observations = useObservationsQuery(region)
    const savedCodes = useSavedCodes()
    // Notable sightings are only fetched once someone asks for them.
    const notable = useNotableQuery(region, alertType === 'notable')

    const birdAlerts = useMemo(
      () => (observations.data ?? []).filter(obs => savedCodes.has(obs.speciesCode)),
      [observations.data, savedCodes]
    )

    if (!birdAlerts.length) {
        return (
            <div className='alerts-header-box' id='alertsDontExist'>
                <h2 className='alerts-header'>No alerts in your area.</h2>
            </div>
        )
    }

    const shown = alertType === 'star' ? birdAlerts : (notable.data ?? [])

    return (
      <div id='birdAlerts'>
          <div className='alerts-header-box' id='alertsExist'>
            <div className={`material-symbols-outlined alert-icon ${alertType === 'star' ? 'button-pressed' : ''}`} id='star' role='button' aria-pressed={alertType === 'star'} onClick={() => setAlertType('star')}>grade</div>
            <h2 className='alerts-header'>Alerts:</h2>
            <div className={`material-symbols-outlined alert-icon ${alertType === 'notable' ? 'button-pressed' : ''}`} id='notable' role='button' aria-pressed={alertType === 'notable'} onClick={() => setAlertType('notable')}>crisis_alert</div>
          </div>
          {alertType === 'notable' && notable.isPending && <div className='spinner'></div>}
          {shown.map(alert => (
            <a key={`${alert.subId}-${alert.speciesCode}`} href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`} target="_blank" rel="noreferrer">
              <AlertCard alert={alert} />
            </a>
          ))}
      </div>
    )
}

export default BirdAlerts
