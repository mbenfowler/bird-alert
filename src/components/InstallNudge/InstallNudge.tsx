import { useState } from 'react'
import { useLocation } from 'react-router'
import { isIOS, isStandalone } from '../../install'
import { ShareIcon } from '../Icons/Icons'
import './InstallNudge.css'

const KEY = 'installNudge'
// Safari and the Home Screen app keep separate storage, so Safari can't tell it was installed:
// past a few visits, or once dismissed, it stops asking.
const MAX_VISITS = 3
const HIDDEN_ON = ['/welcome', '/login', '/share/']

const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (value: string) => { try { localStorage.setItem(KEY, value) } catch { /* private mode: it just asks again */ } }

/** Counts this visit once per browser session, and says whether the nudge should show. */
const shouldShow = () => {
  if (!isIOS() || isStandalone()) return false
  const seen = read()
  if (seen === 'dismissed') return false
  let visits = Number(seen) || 0
  try {
    if (!sessionStorage.getItem(KEY)) { sessionStorage.setItem(KEY, '1'); visits += 1; write(String(visits)) }
  } catch { visits = 1 }
  return visits <= MAX_VISITS
}

/** A one-line nudge for iPhone Safari: alerts need Bird Alert! on the Home Screen. */
const InstallNudge = () => {
  const { pathname } = useLocation()
  const [show, setShow] = useState(shouldShow)
  if (!show || HIDDEN_ON.some(p => pathname.startsWith(p))) return null
  return (
    <aside className='install-nudge' role='status'>
      <p>
        <strong>Get alerts on this iPhone:</strong> tap Share <ShareIcon className='install-nudge__icon' /> then <strong>Add to Home Screen</strong>.
      </p>
      <button type='button' className='pill-button pill-button--small' onClick={() => { write('dismissed'); setShow(false) }}>Got it</button>
    </aside>
  )
}

export default InstallNudge
