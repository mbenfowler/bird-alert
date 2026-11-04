import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSessionQuery } from '../../hooks/queries'
import { inviteLinkQuery, shareInvite } from '../../share'
import { finishNudge, mayNudge, nudgeDone, onInviteNudge, type InviteMoment } from '../../invite'
import { ShareIcon } from '../Icons/Icons'
import '../PushAsk/PushAsk.css'
import './InviteFriend.css'
import { t } from '../../i18n'

/** Settings → Account: always there, for whenever someone thinks of a friend. */
export const InviteRow = () => {
  // Asked for as the page opens, so the tap goes straight to the share sheet.
  useQuery(inviteLinkQuery)
  return (
    <section className='life-list invite-friend'>
      <div className='notification life-list__card'>
        <div className='notification__text'>
          <p className='invite-friend__title'>{t('invite.row')}</p>
          <p className='notification__hint'>{t('invite.rowHint')}</p>
        </div>
        <button type='button' className='pill-button life-list__view' id='inviteFriend' onClick={() => void shareInvite()}>
          <ShareIcon className='pill-button__icon' />{t('invite.button')}
        </button>
      </div>
    </section>
  )
}

// A lifer's feathers and banner get their moment before the question comes up.
const LIFER_PAUSE_MS = 2000

/**
 * The one-time nudge after a happy moment (see invite.ts), in the push ask's spot and style:
 * one line, Invite, and Not now. Either answer, and it never shows again.
 */
export const InviteNudge = () => {
  const user = useSessionQuery().data
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  // What the listener decides from, kept current without re-registering it.
  const now = useRef({ user, pathname })
  useEffect(() => { now.current = { user, pathname } }, [user, pathname])
  useEffect(() => {
    let timer: number | undefined
    const off = onInviteNudge((moment: InviteMoment) => {
      const { user: u, pathname: path } = now.current
      if (!u || document.documentElement.dataset.pushAsk) return false
      if (!mayNudge({ createdAt: u.created_at, now: Date.now(), pathname: path, eventToday: Boolean(u.activeEvent), done: nudgeDone() })) return false
      timer = window.setTimeout(() => setOpen(true), moment === 'lifer' ? LIFER_PAUSE_MS : 0)
      return true
    })
    return () => { off(); window.clearTimeout(timer) }
  }, [])
  // Never over an event's pages.
  if (!open || pathname.startsWith('/events')) return null
  return <Sheet onClose={() => setOpen(false)} />
}

const Sheet = ({ onClose }: { onClose: () => void }) => {
  const sheet = useRef<HTMLElement>(null)
  useQuery(inviteLinkQuery)
  const notNow = () => { finishNudge('not-now'); onClose() }
  const invite = () => { finishNudge('invited'); onClose(); void shareInvite() }
  // Escape is "Not now".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') notNow() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // Read out as it appears; the install nudge steps aside meanwhile, as it does for the push ask.
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    document.documentElement.dataset.pushAsk = 'open'
    return () => { delete document.documentElement.dataset.pushAsk }
  }, [])
  return (
    <aside className='push-ask invite-nudge' role='dialog' aria-modal='false' aria-labelledby='invite-nudge-question' tabIndex={-1} ref={sheet}>
      <p className='push-ask__question' id='invite-nudge-question'>{t('invite.nudge')}</p>
      <div className='push-ask__actions'>
        <button type='button' className='pill-button pill-button--primary' onClick={invite}><ShareIcon className='pill-button__icon' />{t('invite.button')}</button>
        <button type='button' className='push-ask__later' onClick={notNow}>{t('invite.notNow')}</button>
      </div>
    </aside>
  )
}
