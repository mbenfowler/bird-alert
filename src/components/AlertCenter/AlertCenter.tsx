import { useEffect, type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage, sendEmailPreview } from '../../apiCalls'
import { useCurrentUser, usePushStatusQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { LoadingState } from '../Loading/Loading'
import type { EmailPreference, EmailPreviewKind, EmailPreviewResult, PushPreference } from '../../types'
import './AlertCenter.css'

const PUSH_KINDS: { field: PushPreference; label: string; hint: string }[] = [
  { field: 'push_watchlist_enabled', label: 'Watch list sightings', hint: 'One notification an hour listing every bird of yours reported since the last check.' },
  { field: 'push_notable_enabled', label: 'Notable sightings', hint: "eBird's uncommon birds for your area." },
  { field: 'push_first_of_season', label: 'First of the season', hint: 'The first report of a migrant returning to your area, once per species each season.' }
]

const EMAIL_PREFERENCES: { field: EmailPreference; label: string; hint: string; preview: EmailPreviewKind; nothing: string }[] = [
  { field: 'alert_digest_email_enabled', label: 'Daily email digest', hint: 'One email a morning when a bird on your watch list was seen nearby.', preview: 'watchlist', nothing: 'none of your watch-list birds were reported nearby in the last day.' },
  { field: 'rare_sightings_email_enabled', label: 'Uncommon sightings email', hint: "eBird's notable sightings for your area, once a day.", preview: 'rare', nothing: 'no notable sightings nearby in the last day.' },
  { field: 'migration_email_enabled', label: 'Weekly migration email', hint: 'Sundays: who arrived this week, who moved on, and who to expect next.', preview: 'migration', nothing: 'no migration news for your county yet.' }
]

const pushHint: Record<string, string> = {
  checking: 'Checking this browser…',
  unsupported: 'This browser cannot receive push notifications.',
  denied: 'Notifications are blocked for this site in your browser settings.',
  off: 'Turn on to get notified on this device. On iPhone, add Bird Alert to your Home Screen first.',
  on: 'This device will be notified. Choose what below. Android and Windows show the bird photo, a map and buttons; Mac shows the app icon and buttons; iPhone shows text only.',
  busy: 'Updating…'
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` }))

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `${Math.round(hours / 24)} days ago`
}

const AlertCenter = () => {
  const user = useCurrentUser()
  const patchUser = usePatchUserMutation()
  const push = usePushNotifications()
  const status = usePushStatusQuery()

  // Quiet hours are judged in the user's own zone, which only the browser knows; keep it current.
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  useEffect(() => {
    if (browserZone && user.timezone !== browserZone && !patchUser.isPending) patchUser.mutate({ timezone: browserZone })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserZone, user.timezone])

  const quietOn = user.push_quiet_start !== null && user.push_quiet_end !== null
  const setQuiet = (changes: { push_quiet_start?: number | null; push_quiet_end?: number | null }) => {
    patchUser.mutate(changes, {
      onSuccess: () => toast.success('Quiet hours updated!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }
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
      success: { render: ({ data }) => (data && data.sent > 0 ? 'Sent to this device. Check your notifications.' : 'This device did not receive it; try turning push off and on.'), position: 'bottom-center' },
      error: { render: ({ data }) => errorMessage(data), position: 'bottom-center' }
    })
  }

  // "Send me this now": the real email, today, regardless of the schedule, so it can be seen before opting in.
  const previewEmail = (kind: EmailPreviewKind, nothing: string) => {
    toast.promise(sendEmailPreview(kind), {
      pending: { render: 'Sending…', position: 'bottom-center' },
      success: {
        render: ({ data }: { data: EmailPreviewResult }) => data.sent ? `Sent to ${user.email}. Check your inbox.`
          : data.reason === 'nothing' ? `Nothing to send right now: ${nothing}`
          : data.reason === 'unconfirmed' ? 'Confirm your email address first; the confirmation link is in your inbox.'
          : 'Set your county in settings first.',
        position: 'bottom-center'
      },
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
        {status.data?.lastRun && (
          <p className='last-checked' data-testid='last-checked'>
            Last checked {timeAgo(status.data.lastRun.at)}
            {status.data.lastRun.notified ? ` · ${status.data.lastRun.notified} notified` : ' · nothing new'}
            {status.data.lastRun.heldForQuietHours ? ` · ${status.data.lastRun.heldForQuietHours} waiting for quiet hours to end` : ''}
            {status.data.devices > 1 ? ` · ${status.data.devices} devices` : ''}
          </p>
        )}

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
          <div className='notification notification--sub'>
            <div className='notification__text'>
              <label htmlFor='push_quiet_enabled'>Quiet hours</label>
              <p className='notification__hint'>
                {quietOn ? `No pushes between ${HOURS[user.push_quiet_start!].label} and ${HOURS[user.push_quiet_end!].label}; they arrive after.` : 'Pushes can arrive at any hour.'}
                {user.timezone ? ` Your time zone: ${user.timezone.replace('_', ' ')}.` : ''}
              </p>
            </div>
            <div className='notification__controls'>
              <input className='switch switch--small' type='checkbox' id='push_quiet_enabled' name='push_quiet_enabled' checked={quietOn} disabled={!pushOn || patchUser.isPending}
                onChange={(e) => setQuiet(e.target.checked ? { push_quiet_start: 22, push_quiet_end: 6 } : { push_quiet_start: null, push_quiet_end: null })} />
            </div>
          </div>
          {quietOn && (
            <div className='quiet-range' aria-label='Quiet hours range'>
              <label>From
                <select value={user.push_quiet_start ?? 22} disabled={!pushOn || patchUser.isPending} onChange={(e) => setQuiet({ push_quiet_start: Number(e.target.value) })}>
                  {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </label>
              <label>to
                <select value={user.push_quiet_end ?? 6} disabled={!pushOn || patchUser.isPending} onChange={(e) => setQuiet({ push_quiet_end: Number(e.target.value) })}>
                  {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </label>
            </div>
          )}
          {pushOn && <button type='button' className='test-push' onClick={sendTest}>Send a test notification</button>}
        </div>
      </div>

      {EMAIL_PREFERENCES.map(({ field, label, hint, preview, nothing }) => (
        <div className='notification' key={field}>
          <div className='notification__text'>
            <label htmlFor={field}>{label}</label>
            <p className='notification__hint'>{hint}</p>
            <button type='button' className='test-push test-push--inline' data-preview={preview} onClick={() => previewEmail(preview, nothing)}>Send me this now</button>
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
