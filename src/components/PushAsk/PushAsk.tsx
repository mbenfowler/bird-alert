import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { usePatchUserMutation } from '../../hooks/mutations'
import { useCurrentUser } from '../../hooks/queries'
import { dismissPushAsk, dismissRestore, onPushAsk, withArticle, type PushAskVariant } from '../../pushAsk'
import { isIOS } from '../../install'
import InstallSteps from '../InstallSteps/InstallSteps'
import './PushAsk.css'
import { t } from '../../i18n'

/**
 * The ask that follows saving a bird when this device doesn't get alerts yet (see pushAsk.ts): one
 * plain question, one button that turns push on here, and a quiet "Not now". In an iPhone's Safari
 * tab, where push can't work, the same question with the steps to the Home Screen app instead.
 * And when alerts were on here but the browser dropped them, one tap to turn them back on.
 */
const PushAsk = () => {
  const [ask, setAsk] = useState<{ name: string; variant: PushAskVariant } | null>(null)
  useEffect(() => onPushAsk(setAsk), [])
  if (!ask) return null
  if (ask.variant === 'restore') return <Sheet key='restore' name='' variant='restore' onClose={() => setAsk(null)} />
  return <Sheet key={ask.name} name={ask.name} variant={ask.variant} onClose={() => setAsk(null)} />
}

const Sheet = ({ name, variant, onClose }: { name: string; variant: PushAskVariant; onClose: () => void }) => {
  const sheet = useRef<HTMLElement>(null)
  const notNow = () => { if (variant === 'restore') dismissRestore(); else dismissPushAsk(); onClose() }
  // Escape is "Not now", from anywhere on the page while the ask is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') notNow() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // Brought into reach for keyboards and screen readers as it appears; the install nudge steps aside meanwhile.
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    document.documentElement.dataset.pushAsk = 'open'
    return () => { delete document.documentElement.dataset.pushAsk }
  }, [])
  return (
    <aside className='push-ask' role='dialog' aria-modal='false' aria-labelledby='push-ask-question' tabIndex={-1} ref={sheet}>
      <p className='push-ask__question' id='push-ask-question'>
        {variant === 'restore'
          ? t(isIOS() || /Android/i.test(navigator.userAgent) ? 'pushAsk.restorePhone' : 'pushAsk.restoreDevice')
          : t('pushAsk.question', { bird: withArticle(name) })}
      </p>
      {variant === 'install'
        ? (
          <>
            <InstallSteps compact />
            <div className='push-ask__actions'>
              <button type='button' className='push-ask__later' onClick={notNow}>{t('pushAsk.notNow')}</button>
            </div>
          </>
        )
        : <EnableActions name={name} restore={variant === 'restore'} onDone={onClose} onNotNow={notNow} />}
    </aside>
  )
}

const EnableActions = ({ name, restore = false, onDone, onNotNow }: { name: string; restore?: boolean; onDone: () => void; onNotNow: () => void }) => {
  const push = usePushNotifications()
  const user = useCurrentUser()
  const patch = usePatchUserMutation()
  const [asked, setAsked] = useState(false)
  const finished = useRef(false)
  // Once the browser has answered: on means done (with watch-list pushes on, which they are unless
  // someone turned them off). Once only, however often this renders before it closes.
  useEffect(() => {
    if (!asked || push.state !== 'on' || finished.current) return
    finished.current = true
    // Back on after the browser dropped them: what they had chosen stays as it was.
    if (!restore && user.push_watchlist_enabled === false) patch.mutate({ push_watchlist_enabled: true })
    toast.success(restore ? t('pushAsk.restored') : t('pushAsk.on', { name }), { position: 'bottom-center' })
    onDone()
  }, [asked, push.state, user.push_watchlist_enabled, patch, name, restore, onDone])
  if (asked && push.state === 'denied') {
    return (
      <>
        <p className='push-ask__note' role='alert'>{t('pushAsk.blocked')}</p>
        <div className='push-ask__actions'>
          <button type='button' className='pill-button pill-button--small' onClick={onDone}>{t('common.ok')}</button>
        </div>
      </>
    )
  }
  return (
    <>
      {asked && push.error && <p className='push-ask__note' role='alert'>{t('pushAsk.failed', { error: push.error })}</p>}
      <div className='push-ask__actions'>
        <button type='button' className='pill-button pill-button--primary' disabled={push.state === 'busy' || push.state === 'checking'}
          onClick={() => { setAsked(true); void push.enable() }}>
          {push.state === 'busy' ? t('pushAsk.turningOn') : restore ? t('pushAsk.restoreTurnOn') : t('pushAsk.turnOn')}
        </button>
        <button type='button' className='push-ask__later' onClick={onNotNow}>{t('pushAsk.notNow')}</button>
      </div>
    </>
  )
}

export default PushAsk
