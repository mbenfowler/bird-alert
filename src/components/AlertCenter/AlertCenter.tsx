import { useState, type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { useBirds, useCurrentUser } from '../BirdsContext/BirdsContext'
import { patchUser, errorMessage } from '../../apiCalls'
import type { EmailPreference } from '../../types'
import './AlertCenter.css'

const PREFERENCES: { field: EmailPreference; label: string }[] = [
  { field: 'alert_digest_email_enabled', label: 'Alert Digest (daily)' },
  { field: 'rare_sightings_email_enabled', label: 'Uncommon Sightings' }
]

const AlertCenter = () => {
  const user = useCurrentUser()
  const { setUser } = useBirds()
  const [pendingField, setPendingField] = useState<EmailPreference | null>(null)

  const toggleAlert = async (e: ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as EmailPreference
    const enabled = e.target.checked
    setPendingField(field)
    try {
      const updated = await patchUser({ [field]: enabled })
      setUser(updated)
      toast.success('Alert preferences updated!', { position: 'bottom-center' })
    } catch (error) {
      toast.error(errorMessage(error), { position: 'bottom-center' })
    } finally {
      setPendingField(null)
    }
  }

  return (
    <section className="alert-center">
      <h2>Alert center</h2>
      {PREFERENCES.map(({ field, label }) => (
        <div className='notification' key={field}>
          <label htmlFor={field}>{label}</label>
          <input type="checkbox" id={field} name={field} checked={Boolean(user[field])} disabled={pendingField === field} onChange={toggleAlert} />
        </div>
      ))}
    </section>
  )
}

export default AlertCenter
