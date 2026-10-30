import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'react-toastify'
import { errorMessage, resendConfirmationEmail } from '../../apiCalls'
import { useSessionQuery } from '../../hooks/queries'
import './ConfirmNudge.css'

const KEY = 'confirmNudge'
// Setup and sign-in have their own flow; settings already says it beside the address.
const HIDDEN_ON = ['/welcome', '/login', '/share/', '/confirm/', '/reset/', '/unsubscribe/', '/settings']

const laterThisSession = () => { try { return sessionStorage.getItem(KEY) === 'later' } catch { return false } }

/**
 * Until someone confirms their address, no alert or digest email can reach them, and most never
 * open settings to find out. This says so at the top of every page, with the address, where the
 * link may have landed, and a way to resend it or fix a typo. "Later" hides it for this visit.
 */
const ConfirmNudge = () => {
  const { pathname } = useLocation()
  const user = useSessionQuery().data
  const [later, setLater] = useState(laterThisSession)
  const [sending, setSending] = useState(false)
  if (!user || user.email_confirmed || later || HIDDEN_ON.some(p => pathname.startsWith(p))) return null

  const resend = () => {
    setSending(true)
    resendConfirmationEmail()
      .then(() => toast.success(`Sent. Look for “Confirm your email for Bird Alert” at ${user.email}.`, { position: 'bottom-center' }))
      .catch((error) => toast.error(errorMessage(error), { position: 'bottom-center' }))
      .finally(() => setSending(false))
  }
  const hide = () => { try { sessionStorage.setItem(KEY, 'later') } catch { /* private mode: it shows again next page */ } setLater(true) }

  return (
    <aside className='confirm-nudge' role='status'>
      <p><strong>Confirm your email to get alerts by email.</strong> We sent a link to <strong>{user.email}</strong>. Not there? Check Spam and Promotions.</p>
      <div className='confirm-nudge__actions'>
        <button type='button' className='pill-button pill-button--small pill-button--primary' onClick={resend} disabled={sending}>{sending ? 'Sending…' : 'Resend'}</button>
        <Link className='pill-button pill-button--small' to='/settings'>Wrong address?</Link>
        <button type='button' className='confirm-nudge__later' onClick={hide}>Later</button>
      </div>
    </aside>
  )
}

export default ConfirmNudge
