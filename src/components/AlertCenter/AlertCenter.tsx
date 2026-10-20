import { type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { LoadingState } from '../Loading/Loading'
import type { EmailPreference } from '../../types'
import './AlertCenter.css'

const PREFERENCES: { field: EmailPreference; label: string; hint: string }[] = [
  { field: 'alert_digest_email_enabled', label: 'Daily email digest', hint: 'One email a morning when a bird on your watch list was seen nearby.' },
  { field: 'rare_sightings_email_enabled', label: 'Uncommon sightings email', hint: "eBird's notable sightings for your area, once a day." }
]

const pushHint: Record<string, string> = {
  checking: 'Checking this browser…',
  unsupported: 'This browser cannot receive push notifications.',
  denied: 'Notifications are blocked for this site in your browser settings.',
  off: 'Within the hour of a watch-list bird being reported nearby. On iPhone, add Bird Alert to your Home Screen first.',
  on: 'This device will be notified within the hour of a watch-list bird being reported nearby.',
  busy: 'Updating…'
}

const AlertCenter = () => {
  const user = useCurrentUser()
  const patchUser = usePatchUserMutation()
  const push = usePushNotifications()
  const pendingField = patchUser.isPending ? Object.keys(patchUser.variables ?? {})[0] : null

  const toggleEmail = (e: ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as EmailPreference
    patchUser.mutate({ [field]: e.target.checked }, {
      onSuccess: () => toast.success('Alert preferences updated!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }

  const togglePush = (e: ChangeEvent<HTMLInputElement>) => {
    void (e.target.checked ? push.enable() : push.disable())
  }

  const sendTest = () => {
    toast.promise(push.sendTest(), {
      pending: { render: 'Sending a test notification…', position: 'bottom-center' },
      success: { render: ({ data }) => (data && data.sent > 0 ? 'Sent! Check your notifications.' : 'No device received it; try turning push off and on.'), position: 'bottom-center' },
      error: { render: ({ data }) => errorMessage(data), position: 'bottom-center' }
    })
  }

  const pushDisabled = push.state === 'checking' || push.state === 'unsupported' || push.state === 'denied' || push.state === 'busy'

  return (
    <section className="alert-center">
      <h2 className='fredericka'>Alert center</h2>

      <div className='notification'>
        <div className='notification__text'>
          <label htmlFor='push_enabled'>Push notifications on this device</label>
          <p className='notification__hint'>{pushHint[push.state]}</p>
          {push.error && <p className='notification__hint notification__hint--error' role='alert'>{push.error}</p>}
        </div>
        <div className='notification__controls'>
          {push.state === 'busy' && <LoadingState variant='inline' label='Updating push notifications' />}
          <input className='switch' type='checkbox' id='push_enabled' name='push_enabled' checked={push.state === 'on'} disabled={pushDisabled} onChange={togglePush} />
        </div>
      </div>
      {push.state === 'on' && (
        <button type='button' className='test-push' onClick={sendTest}>Send a test notification</button>
      )}

      {PREFERENCES.map(({ field, label, hint }) => (
        <div className='notification' key={field}>
          <div className='notification__text'>
            <label htmlFor={field}>{label}</label>
            <p className='notification__hint'>{hint}</p>
          </div>
          <div className='notification__controls'>
            <input className='switch' type="checkbox" id={field} name={field} checked={Boolean(user[field])} disabled={pendingField === field} onChange={toggleEmail} />
          </div>
        </div>
      ))}
    </section>
  )
}

export default AlertCenter
