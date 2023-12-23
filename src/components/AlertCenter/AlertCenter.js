import { useContext, useState, useEffect } from 'react'
import BirdsContext from '../BirdsContext/BirdsContext'
import { patchUser } from '../../apiCalls'
import './AlertCenter.css'

const AlertCenter = ({ isLoaded }) => {
  const { user, setUser } = useContext(BirdsContext)
  const [alertDigestEnabled, setAlertDigestEnabled] = useState(false)
  const [uncommonSightingsEnabled, setUncommonSightingsEnabled] = useState(false)

  useEffect(() => {
    setAlertDigestEnabled(user.alert_digest_email_enabled)
    setUncommonSightingsEnabled(user.rare_sightings_email_enabled)
  }, [user])

  const toggleAlert = async (e) => {
    try {
      const alertType = e.target.id
      const isChecked = e.target.checked
      const updatedUser = { [alertType]: `${isChecked}` }
      await patchUser(user.email, updatedUser)
      setUser({ ...user, [alertType]: isChecked })

      if (alertType === 'alert_digest_email_enabled') {
        setAlertDigestEnabled(isChecked)
      } else if (alertType === 'rare_sightings_email_enabled') {
        setUncommonSightingsEnabled(isChecked)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <>
      {isLoaded &&
      <section className="alert-center">
        <h2>Alert center</h2>
        <div className='notification'>
          <label htmlFor="alert_digest_email_enabled">Alert Digest (daily)</label>
          <input type="checkbox" id="alert_digest_email_enabled" name="alert_digest_email_enabled" checked={alertDigestEnabled} onChange={toggleAlert} />
        </div>
        <div className='notification'>
          <label htmlFor="rare_sightings_email_enabled">Uncommon Sightings</label>
          <input type="checkbox" id="rare_sightings_email_enabled" name="rare_sightings_email_enabled" checked={uncommonSightingsEnabled} onChange={toggleAlert}/>
        </div>
      </section>}
    </>
  )
}

export default AlertCenter
