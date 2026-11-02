import { useEffect, type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage, sendEmailPreview } from '../../apiCalls'
import { useCurrentUser, usePushStatusQuery, useSeenBirdsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { LoadingState } from '../Loading/Loading'
import type { EmailPreference, EmailPreviewKind, EmailPreviewResult, PushPreference } from '../../types'
import './AlertCenter.css'
import AlertModeSettings from '../AlertModeSettings/AlertModeSettings'
import AlertRange from './AlertRange'
import InstallSteps from '../InstallSteps/InstallSteps'
import { isIOS, isStandalone } from '../../install'
import { countyWord } from '../../usStates'
import { hourLabel, t } from '../../i18n'

// Labels, hints and the "nothing to send" words are in the catalog under alertCenter.push.<field> and alertCenter.email.<field>.
const PUSH_KINDS: PushPreference[] = ['push_watchlist_enabled', 'push_notable_enabled', 'push_first_of_season', 'push_lifer_enabled']
// Lifer alerts measure against the life list; with only a few birds on it, nearly everything is a lifer.
const MIN_LIFE_LIST = 10

const EMAIL_PREFERENCES: { field: EmailPreference; preview: EmailPreviewKind }[] = [
  { field: 'alert_digest_email_enabled', preview: 'watchlist' },
  { field: 'rare_sightings_email_enabled', preview: 'rare' },
  { field: 'migration_email_enabled', preview: 'migration' }
]

const HOURS = Array.from({ length: 24 }, (_, h) => h)

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return t('landing.justNow')
  if (minutes < 60) return t('alertCenter.minAgo', { count: minutes })
  const hours = Math.round(minutes / 60)
  return hours < 48 ? t('still.hoursAgo', { count: hours }) : t('landing.daysAgo', { count: Math.round(hours / 24) })
}

const AlertCenter = () => {
  const user = useCurrentUser()
  const lifeListSize = useSeenBirdsQuery().data?.length ?? 0
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
      onSuccess: () => toast.success(t('alertCenter.quietUpdated'), { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }
  const pendingField = patchUser.isPending ? Object.keys(patchUser.variables ?? {})[0] : null

  const togglePreference = (e: ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as EmailPreference | PushPreference
    patchUser.mutate({ [field]: e.target.checked }, {
      onSuccess: () => toast.success(t('alertCenter.updated'), { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }

  const setNotableTiming = (batched: boolean) => {
    if (batched === Boolean(user.push_notable_batched)) return
    patchUser.mutate({ push_notable_batched: batched }, {
      onSuccess: () => toast.success(batched ? t('alertCenter.batched') : t('alertCenter.rightAwayToast'), { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }

  const togglePush = (e: ChangeEvent<HTMLInputElement>) => {
    void (e.target.checked ? push.enable() : push.disable())
  }

  const sendTest = () => {
    toast.promise(push.sendTest(), {
      pending: { render: t('alertCenter.testSending'), position: 'bottom-center' },
      success: { render: ({ data }) => (data && data.sent > 0 ? t('alertCenter.testSent') : t('alertCenter.testMissed')), position: 'bottom-center' },
      error: { render: ({ data }) => errorMessage(data), position: 'bottom-center' }
    })
  }

  // "Send me this now": the real email, today, regardless of the schedule, so it can be seen before opting in.
  const previewEmail = (kind: EmailPreviewKind, field: EmailPreference) => {
    toast.promise(sendEmailPreview(kind), {
      pending: { render: t('common.sending'), position: 'bottom-center' },
      success: {
        render: ({ data }: { data: EmailPreviewResult }) => data.sent ? t('alertCenter.previewSent', { email: user.email })
          : data.reason === 'nothing' ? t('alertCenter.previewNothing', { nothing: t(`alertCenter.email.${field}.nothing`) })
          : data.reason === 'unconfirmed' ? t('alertCenter.previewUnconfirmed')
          : t('alertCenter.previewNoArea', { word: countyWord(user.state) }),
        position: 'bottom-center'
      },
      error: { render: ({ data }) => errorMessage(data), position: 'bottom-center' }
    })
  }

  const pushOn = push.state === 'on'
  const needsInstall = isIOS() && !isStandalone()
  const pushDisabled = push.state === 'checking' || push.state === 'unsupported' || push.state === 'denied' || push.state === 'busy'

  return (
    <section className="alert-center">
      <h2 className='fredericka'>{t('alertCenter.title')}</h2>

      {/* In a Safari tab on an iPhone push can't be had at all, so none of its settings show: just how
          to get the Home Screen app, where they all are. */}
      {needsInstall ? (
        <div className='notification-group install-group'>
          <h3 className='install-group__title'>{t('alertCenter.iphoneTitle')}</h3>
          <InstallSteps compact />
        </div>
      ) : (
      <div className={`notification-group ${pushOn ? 'is-on' : ''}`}>
        <div className='notification'>
          <div className='notification__text'>
            <label htmlFor='push_enabled'>{t('alertCenter.pushLabel')}</label>
            <p className='notification__hint'>{t(`alertCenter.pushHint.${push.state}`)}</p>
            {push.error && <p className='notification__hint notification__hint--error' role='alert'>{push.error}</p>}
          </div>
          <div className='notification__controls'>
            {push.state === 'busy' && <LoadingState variant='inline' label={t('alertCenter.updatingPush')} />}
            <input className='switch' type='checkbox' id='push_enabled' name='push_enabled' checked={pushOn} disabled={pushDisabled} onChange={togglePush} />
          </div>
        </div>
        {status.data?.lastRun && (
          <p className='last-checked' data-testid='last-checked'>
            {[
              t('alertCenter.lastChecked', { when: timeAgo(status.data.lastRun.at) }),
              status.data.lastRun.notified ? t('alertCenter.notified', { count: status.data.lastRun.notified }) : t('alertCenter.nothingNew'),
              status.data.lastRun.heldForQuietHours ? t('alertCenter.held', { count: status.data.lastRun.heldForQuietHours }) : null,
              status.data.devices > 1 ? t('alertCenter.devices', { count: status.data.devices }) : null
            ].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Sub-options sit greyed out until push is on for this device. */}
        <div className='notification-sub' aria-disabled={!pushOn}>
          {PUSH_KINDS.map((field) => (
            <div key={field}>
              <div className='notification notification--sub'>
                <div className='notification__text'>
                  <label htmlFor={field}>{t(`alertCenter.push.${field}.label`)}</label>
                  <p className='notification__hint'>{t(`alertCenter.push.${field}.hint`)}{field === 'push_lifer_enabled' && lifeListSize < MIN_LIFE_LIST ? ` ${t('alertCenter.liferNeeds', { count: MIN_LIFE_LIST })}` : ''}</p>
                </div>
                <div className='notification__controls'>
                  <input className='switch switch--small' type='checkbox' id={field} name={field} checked={Boolean(user[field])} disabled={!pushOn || pendingField === field || (field === 'push_lifer_enabled' && !user[field] && lifeListSize < MIN_LIFE_LIST)} onChange={togglePreference} />
                </div>
              </div>
              {field === 'push_notable_enabled' && (
                <fieldset className='timing' disabled={!pushOn || !user.push_notable_enabled || pendingField === 'push_notable_batched'}>
                  <legend className='visually-hidden'>{t('alertCenter.timingLegend')}</legend>
                  <label className={`timing__option ${!user.push_notable_batched ? 'is-selected' : ''}`}>
                    <input type='radio' name='push_notable_timing' value='asap' checked={!user.push_notable_batched} onChange={() => setNotableTiming(false)} />
                    {t('alertCenter.rightAway')}
                  </label>
                  <label className={`timing__option ${user.push_notable_batched ? 'is-selected' : ''}`}>
                    <input type='radio' name='push_notable_timing' value='batched' checked={Boolean(user.push_notable_batched)} onChange={() => setNotableTiming(true)} />
                    {t('alertCenter.batch')}
                  </label>
                </fieldset>
              )}
            </div>
          ))}
          <div className='notification notification--sub'>
            <div className='notification__text'>
              <label htmlFor='push_quiet_enabled'>{t('alertCenter.quiet')}</label>
              <p className='notification__hint'>
                {quietOn ? t('alertCenter.quietOn', { from: hourLabel(user.push_quiet_start!), to: hourLabel(user.push_quiet_end!) }) : t('alertCenter.quietOff')}
                {user.timezone ? ` ${t('alertCenter.timezone', { zone: user.timezone.replace('_', ' ') })}` : ''}
              </p>
            </div>
            <div className='notification__controls'>
              <input className='switch switch--small' type='checkbox' id='push_quiet_enabled' name='push_quiet_enabled' checked={quietOn} disabled={!pushOn || patchUser.isPending}
                onChange={(e) => setQuiet(e.target.checked ? { push_quiet_start: 22, push_quiet_end: 6 } : { push_quiet_start: null, push_quiet_end: null })} />
            </div>
          </div>
          {quietOn && (
            <div className='quiet-range' aria-label={t('alertCenter.quietRange')}>
              <label>{t('alertCenter.from')}
                <select value={user.push_quiet_start ?? 22} disabled={!pushOn || patchUser.isPending} onChange={(e) => setQuiet({ push_quiet_start: Number(e.target.value) })}>
                  {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
              <label>{t('alertCenter.to')}
                <select value={user.push_quiet_end ?? 6} disabled={!pushOn || patchUser.isPending} onChange={(e) => setQuiet({ push_quiet_end: Number(e.target.value) })}>
                  {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
            </div>
          )}
          {/* Alert! mode: per device, on by default; only for alerts that arrive while the app is on screen. */}
          <div className='notification notification--sub'>
            <div className='notification__text'>
              <span className='notification__label' id='alert-mode-label'>{t('alertCenter.alertMode')}</span>
              <p className='notification__hint'>{t('alertCenter.alertModeHint')}</p>
              <AlertModeSettings disabled={!pushOn} />
            </div>
          </div>
          {pushOn && <button type='button' className='test-push' onClick={sendTest}>{t('alertCenter.sendTest')}</button>}
        </div>
      </div>
      )}

      <AlertRange />

      {EMAIL_PREFERENCES.map(({ field, preview }) => (
        <div className='notification' key={field}>
          <div className='notification__text'>
            <label htmlFor={field}>{t(`alertCenter.email.${field}.label`)}</label>
            <p className='notification__hint'>{t(`alertCenter.email.${field}.hint`)}</p>
            <button type='button' className='test-push test-push--inline' data-preview={preview} onClick={() => previewEmail(preview, field)}>{t('alertCenter.sendNow')}</button>
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
