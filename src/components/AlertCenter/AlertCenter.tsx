import { type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import type { EmailPreference } from '../../types'
import './AlertCenter.css'

const PREFERENCES: { field: EmailPreference; label: string }[] = [
  { field: 'alert_digest_email_enabled', label: 'Alert Digest (daily)' },
  { field: 'rare_sightings_email_enabled', label: 'Uncommon Sightings' }
]

const AlertCenter = () => {
  const user = useCurrentUser()
  const patchUser = usePatchUserMutation()
  const pendingField = patchUser.isPending ? Object.keys(patchUser.variables ?? {})[0] : null

  const toggleAlert = (e: ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as EmailPreference
    patchUser.mutate({ [field]: e.target.checked }, {
      onSuccess: () => toast.success('Alert preferences updated!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
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
