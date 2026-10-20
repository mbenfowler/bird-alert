import { type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { LoadingState } from '../Loading/Loading'
import type { EmailPreference, PushPreference } from '../../types'
import './AlertCenter.css'

const PUSH_KINDS: { field: PushPreference; label: string; hint: string }[] = [
  { field: 'push_watchlist_enabled', label: 'Watch list sightings', hint: 'Sent as soon as the hourly check finds one.' },
  { field: 'push_notable_enabled', label: 'Notable sightings', hint: "eBird's uncommon birds for your area. If one is also on your watch list, you get a single notification, not two." }
]

const EMAIL_PREFERENCES: { field: EmailPreference; label: string; hint: string }[] = [
  { field: 'alert_digest_email_enabled', label: 'Daily email digest', hint: 'One email a morning when a bird on your watch list was seen nearby.' },
  { field: 'rare_sightings_email_enabled', label: 'Uncommon sightings email', hint: "eBird's notable sightings for your area, once a day." }
]

const pushHint: Record<string, string> = {
  checking: 'Checking this browser…',
  unsupported: 'This browser cannot receive push notifications.',
  denied: 'Notifications are blocked for this site in your browser settings.',
  off: 'Turn on to get notified on this device. On iPhone, add Bird Alert to your Home Screen first.',
  on: 'This device will be notified. Choose what below.',
  busy: 'Updating…'
}

const AlertCenter = () => {
  const user = useCurrentUser()
  const patchUser = usePatchUserMutation()
  const push = usePushNotifications()
  const pendingField = patchUser.isPending ? Object.keys(patchUser.variables ?? {})[0] : null

  const togglePreference = (e: ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as EmailPreference | PushPreference
    patchUser.mutate({ [field]: e.target.checked }, {
      onSuccess: () => toast.success('Alert preferences updated!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }

  const setNotableTiming = (batched: boolean) => {
    if (batched === Boolean(user.push_notable_batched)) return
    patchUser.mutate({ push_notable_batched: batched }, {
      onSuccess: () => toast.success(batched ? 'Notable sightings will be batched.' : 'Notable sightings will be sent right away.', { position: 'bottom-center' }),
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

  const pushOn = push.state === 'on'
  const pushDisabled = push.state === 'checking' || push.state === 'unsupported' || push.state === 'denied' || push.state === 'busy'

  return (
    <section className="alert-center">
      <h2 className='fredericka'>Alert center</h2>

      <div className={`notification-group ${pushOn ? 'is-on' : ''}`}>
        <div className='notification'>
          <div className='notification__text'>
            <label htmlFor='push_enabled'>Push notifications on this device</label>
            <p className='notification__hint'>{pushHint[push.state]}</p>
            {push.error && <p className='notification__hint notification__hint--error' role='alert'>{push.error}</p>}
          </div>
          <div className='notification__controls'>
            {push.state === 'busy' && <LoadingState variant='inline' label='Updating push notifications' />}
            <input className='switch' type='checkbox' id='push_enabled' name='push_enabled' checked={pushOn} disabled={pushDisabled} onChange={togglePush} />
          </div>
        </div>

        {/* Sub-options sit greyed out until push is on for this device. */}
        <div className='notification-sub' aria-disabled={!pushOn}>
          {PUSH_KINDS.map(({ field, label, hint }) => (
            <div key={field}>
              <div className='notification notification--sub'>
                <div className='notification__text'>
                  <label htmlFor={field}>{label}</label>
                  <p className='notification__hint'>{hint}</p>
                </div>
                <div className='notification__controls'>
                  <input className='switch switch--small' type='checkbox' id={field} name={field} checked={Boolean(user[field])} disabled={!pushOn || pendingField === field} onChange={togglePreference} />
                </div>
              </div>
              {field === 'push_notable_enabled' && (
                <fieldset className='timing' disabled={!pushOn || !user.push_notable_enabled || pendingField === 'push_notable_batched'}>
                  <legend className='visually-hidden'>How quickly to send notable sightings</legend>
                  <label className={`timing__option ${!user.push_notable_batched ? 'is-selected' : ''}`}>
                    <input type='radio' name='push_notable_timing' value='asap' checked={!user.push_notable_batched} onChange={() => setNotableTiming(false)} />
                    Right away
                  </label>
                  <label className={`timing__option ${user.push_notable_batched ? 'is-selected' : ''}`}>
                    <input type='radio' name='push_notable_timing' value='batched' checked={Boolean(user.push_notable_batched)} onChange={() => setNotableTiming(true)} />
                    Batch every 6 hours
                  </label>
                </fieldset>
              )}
            </div>
          ))}
          {pushOn && <button type='button' className='test-push' onClick={sendTest}>Send a test notification</button>}
        </div>
      </div>

      {EMAIL_PREFERENCES.map(({ field, label, hint }) => (
        <div className='notification' key={field}>
          <div className='notification__text'>
            <label htmlFor={field}>{label}</label>
            <p className='notification__hint'>{hint}</p>
          </div>
          <div className='notification__controls'>
            <input className='switch' type="checkbox" id={field} name={field} checked={Boolean(user[field])} disabled={pendingField === field} onChange={togglePreference} />
          </div>
        </div>
      ))}
    </section>
  )
}

export default AlertCenter
