import { useEffect, useRef, useContext, useState } from "react"
import { Link } from "react-router-dom"
import { nanoid } from 'nanoid'
import BirdsContext from "../BirdsContext/BirdsContext"
import AlertCard from "../AlertCard/AlertCard"
import { getExternalNotableBirds } from "../../apiCalls"
import './BirdAlerts.css'

const BirdAlerts = () => {
    const { user, birdAlerts } = useContext(BirdsContext)
    const [notableBirds, setNotableBirds] = useState([])
    const [alertButton, setAlertButton] = useState('star')
    const starRef = useRef(null);
    const notableRef = useRef(null);

    useEffect(() => {
    }, [birdAlerts])

    useEffect(() => {
      getExternalNotableBirds(user.location)
        .then(res => {
          setNotableBirds(res)
        })
        .catch(err => console.log(err))
    }, [user.location])

    useEffect(() => {
      const starElement = starRef.current
      const notableElement = notableRef.current
      if (starElement && notableElement) {
        if (alertButton === 'star') {
          starElement.classList.add('button-pressed')
          notableElement.classList.remove('button-pressed')
        } else if (alertButton === 'notable') {
          starElement.classList.remove('button-pressed')
          notableElement.classList.add('button-pressed')
        }
      }
    }, [alertButton])

    const alertsByType = alertButton === 'star' ? birdAlerts : notableBirds

    const alerts = alertsByType.map(alert => {
      return (
        <Link key={nanoid()} to={`https://www.google.com/maps?q=${alert.lat},${alert.lng}&label=${alert.comName}`} target="_blank">
          <AlertCard alert={alert} />
        </Link>
      )
    })

    const handleClick = (e) => {
      if (e.target.id !== alertButton) {
        setAlertButton(e.target.id)
      }
    }
    
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
                <div className={`material-symbols-outlined alert-icon ${alertButton === 'star' ? 'button-pressed' : ''}`} id='star' ref={starRef} onClick={handleClick}>grade</div>
                <h2 className='alerts-header'>Alerts:</h2>
                <div className="material-symbols-outlined alert-icon" id='notable' ref={notableRef} onClick={handleClick}>crisis_alert</div>
              </div>
              {alerts}
          </div>
      )
    }
}

export default BirdAlerts
