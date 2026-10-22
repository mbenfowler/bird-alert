import { lazy, Suspense, useEffect, useRef, type ReactElement } from 'react'
import { Routes, Route, useNavigate, useLocation, useNavigationType, Link } from 'react-router'
import { CHANNEL, decidePending, pollInterval, samePath, takePendingOpen, type LatestPush, type PendingTrigger } from '../../notificationHandoff'
import { ackPendingPush, getPendingPush, postPushTrace } from '../../apiCalls'
import type { PendingPush } from '../../types'

// Which build is running, for the notification trace.
const APP_BUILD = '2026-10-22.9'
import { toast, ToastContainer } from 'react-toastify'
import { useSessionQuery } from '../../hooks/queries'
import './App.css'
import Login from '../Login/Login'
import Nav from '../Nav/Nav'
import Home from '../Home/Home'
import NotFound from '../NotFound/NotFound'
import { LoadingState } from '../Loading/Loading'

// Everything off the main path loads on demand, keeping the first visit light.
const Saved = lazy(() => import('../Saved/Saved'))
const Settings = lazy(() => import('../Settings/Settings'))
const EmailConfirm = lazy(() => import('../EmailConfirm/EmailConfirm'))
const Unsubscribe = lazy(() => import('../Unsubscribe/Unsubscribe'))
const PassReset = lazy(() => import('../PassReset/PassReset'))
const Sighting = lazy(() => import('../Sighting/Sighting'))
const MapPage = lazy(() => import('../MapPage/MapPage'))
const AlertSightings = lazy(() => import('../AlertSightings/AlertSightings'))

// Routes reachable without a session. Everything else redirects to /login once we know there is no user.
const PUBLIC_PATH_PREFIXES = ['/login', '/reset/', '/confirm/', '/unsubscribe/']

const App = () => {
  const session = useSessionQuery()
  // undefined while the cookie is being checked; null when logged out (or the API is unreachable).
  const user = session.isError ? null : session.data

  const navigate = useNavigate()
  const { pathname } = useLocation()
  // useNavigate hands out a new function on every route change; the hand-off effect must not restart with it.
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  const isPublicPath = PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
  // Diagnostic: the whole life of a tap near the gear (top-right 96px): start, how it ends (end,
  // cancel, click or nothing), how long it lasted, how far it moved, and whether any handler
  // called preventDefault on it. iOS turns a touch into a click only if none of those go wrong.
  useEffect(() => {
    if (!user) return
    const describe = (el: Element | null) => el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''}` : null
    let start: { x: number; y: number; at: number; moved: number; mutations: number } | null = null
    // Activity while a finger is down: DOM mutations and running animations, which make iOS re-check a pending tap.
    const observer = new MutationObserver((records) => { if (start) start.mutations += records.length })
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
    const runningAnimations = () => {
      const list = typeof document.getAnimations === 'function' ? document.getAnimations() : []
      return { animations: list.length, running: list.slice(0, 6).map((a) => { const effect = a.effect as KeyframeEffect | null; const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id; return `${describe(effect?.target as Element | null)}:${name}:${a.playState}` }) }
    }
    const pointOf = (event: Event) => event instanceof MouseEvent ? event : event instanceof TouchEvent ? (event.touches[0] ?? event.changedTouches[0]) : null
    const nearGear = (x: number, y: number) => x >= window.innerWidth - 96 && y <= 96
    const report = (event: Event, extra: Record<string, unknown> = {}) => {
      const p = pointOf(event)
      void postPushTrace({ event: 'tap-probe', source: 'app', type: event.type, x: p ? Math.round(p.clientX) : null, y: p ? Math.round(p.clientY) : null,
        target: describe(event.target as Element), prevented: event.defaultPrevented, cancelable: event.cancelable,
        sinceStart: start ? Math.round(performance.now() - start.at) : null, moved: start ? Math.round(start.moved) : null, mutations: start ? start.mutations : null, path: window.location.pathname, ...runningAnimations(), ...extra })
    }
    const onStart = (event: Event) => {
      const p = pointOf(event)
      if (!p || !nearGear(p.clientX, p.clientY)) { start = null; return }
      start = { x: p.clientX, y: p.clientY, at: performance.now(), moved: 0, mutations: 0 }
      const safeTop = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0
      // Anything laid out past the right edge of the viewport (outside the horizontal alerts row) makes iOS
      // treat the page as zoomable, which brings the double-tap delay with it.
      const wide = [...document.querySelectorAll('body *')].filter((el) => !el.closest('.alerts-list') && el.getBoundingClientRect().right > window.innerWidth + 0.5 && getComputedStyle(el).position !== 'fixed')
        .slice(0, 5).map((el) => `${describe(el)}@${Math.round(el.getBoundingClientRect().right)}`)
      report(event, { under: describe(document.elementFromPoint(p.clientX, p.clientY)), active: describe(document.activeElement), scrollY: Math.round(window.scrollY),
        inner: [window.innerWidth, window.innerHeight], screen: [window.screen.width, window.screen.height], outer: [window.outerWidth, window.outerHeight],
        standalone: Boolean((navigator as Navigator & { standalone?: boolean }).standalone), safeTop,
        docWidth: [document.documentElement.scrollWidth, document.body.scrollWidth], vvWidth: window.visualViewport ? Math.round(window.visualViewport.width) : null, wide })
    }
    const onMove = (event: Event) => {
      const p = pointOf(event)
      if (start && p) start.moved = Math.max(start.moved, Math.hypot(p.clientX - start.x, p.clientY - start.y))
    }
    const onEnd = (event: Event) => {
      if (!start) return
      report(event, { under: (() => { const p = pointOf(event); return p ? describe(document.elementFromPoint(p.clientX, p.clientY)) : null })() })
      if (event.type === 'click' || event.type === 'touchcancel' || event.type === 'pointercancel') start = null
    }
    // Bubble phase on window, so defaultPrevented reflects every other handler.
    window.addEventListener('touchstart', onStart)
    window.addEventListener('touchmove', onMove, { passive: true })
    for (const type of ['touchend', 'touchcancel', 'pointerup', 'pointercancel', 'click']) window.addEventListener(type, onEnd)
    return () => {
      observer.disconnect()
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      for (const type of ['touchend', 'touchcancel', 'pointerup', 'pointercancel', 'click']) window.removeEventListener(type, onEnd)
    }
  }, [user])

  // Diagnostic: every route change with how it happened (PUSH from code, POP from history/back,
  // REPLACE), to see what follows a gear tap that seems to go nowhere on phones.
  const navigationType = useNavigationType()
  const previousPath = useRef<string | null>(null)
  useEffect(() => {
    const from = previousPath.current
    previousPath.current = pathname
    if (user && from !== pathname) void postPushTrace({ event: 'route', source: 'app', path: pathname, from, type: navigationType, visibility: document.visibilityState, scrollY: Math.round(window.scrollY) })
  }, [pathname, navigationType, user])
  useEffect(() => {
    if (user === null && !isPublicPath) navigate('/login', { replace: true })
  }, [user, isPublicPath, navigate])

  // Push notifications hand off to the page through src/notificationHandoff.ts. The page follows a
  // tap's target on start, on return to the foreground, on a broadcast, or on a short poll while
  // visible, whichever comes first; a push shown while the app is open is also offered as a toast.
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const note = (event: string, detail: Record<string, unknown> = {}) => {
      void postPushTrace({ event, source: 'app', bundle: APP_BUILD, controller: navigator.serviceWorker?.controller?.scriptURL ?? null, visibility: document.visibilityState, path: window.location.pathname, ...detail })
    }
    // A target is followed once, and never offered as a toast when the app is already there or on its way.
    let lastOpened: string | null = null
    const here = () => window.location.pathname + window.location.search
    const go = (path: string | null, via: string) => {
      if (!path || cancelled || path === lastOpened) return
      lastOpened = path
      note('app-open', { via, target: path })
      navigateRef.current(path)
    }
    const offer = (push: LatestPush | null, via: string) => {
      if (!push || cancelled || document.visibilityState !== 'visible') return
      if (push.path === lastOpened || push.path === here()) return
      note('app-toast', { via, target: push.path })
      // On iPhone the system banner is a dead end while the app is open, so this toast is the way in; give it time.
      toast(`${push.title} · tap to view`, { toastId: push.path, position: 'top-center', autoClose: 20000, closeOnClick: true, onClick: () => navigateRef.current(push.path) })
    }
    // The worker's own records and messages are instant where they work (desktop); the toast itself
    // comes only from the server, so it can never race a navigation to the same page.
    const check = () => {
      if (document.visibilityState !== 'visible') return
      void takePendingOpen().then((path) => go(path, 'poll'))
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null
      if (data && data.type === 'open') { void takePendingOpen(); go(samePath(data.url), 'message') }
    }
    // The server knows about every push it sent and every tap the worker reported, which is the
    // only route that reaches an open iPhone app. Polled while visible: quickly after a push.
    let serverTimer: number | undefined
    const askServer = async (trigger: PendingTrigger, via: string = trigger) => {
      if (cancelled || document.visibilityState !== 'visible') return
      let push: PendingPush | null
      try { push = (await getPendingPush()).push } catch { push = null }
      if (cancelled) return
      const decision = decidePending(push, Date.now(), trigger)
      if (trigger === 'foreground' && push && !push.openedAt) note('app-foreground', { via, decision })
      if (decision === 'open' && push) { void ackPendingPush({ opened: true }); go(samePath(push.url), `server-${via}`) }
      else if (decision === 'offer' && push) { const path = samePath(push.url); if (path) { void ackPendingPush({ offered: true }); offer({ title: push.title, path }, 'server') } }
      window.clearTimeout(serverTimer)
      serverTimer = window.setTimeout(() => { void askServer('poll') }, pollInterval(push))
    }
    // Launch, return from the background, and window focus all count as the app being brought forward.
    const onVisible = () => { if (document.visibilityState === 'visible') void askServer('foreground', 'visible') }
    const onFocus = () => { void askServer('foreground', 'focus') }
    check()
    void askServer('foreground', 'start')
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(check, 1500)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('pageshow', check)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    let channel: BroadcastChannel | null = null
    try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = onMessage } catch { channel = null }
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(serverTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('pageshow', check)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
      channel?.close()
    }
  }, [userId])

  // Gate an element on having a user. While the session is being checked, show a spinner.
  const requireUser = (element: ReactElement) => {
    if (user === undefined) return <div className='spinner'></div>
    if (user === null) return null
    return element
  }

  const home = user?.location
    ? <Home />
    : <section id='init'>
        <p id='initText'>Go to settings and set a location</p>
        <Link to='/settings'><button className='navigate-button'>Go to settings</button></Link>
      </section>

  return (
    <>
      <Nav />
      <main className="App">
        <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path='/' element={requireUser(home)} />
          <Route path='/login' element={<Login />} />
          <Route path='/saved' element={requireUser(<Saved />)} />
          <Route path='/settings' element={requireUser(<Settings />)} />
          <Route path='/map' element={requireUser(<MapPage />)} />
          <Route path='/sighting/:code/:subId' element={requireUser(<Sighting />)} />
          <Route path='/sightings' element={requireUser(<AlertSightings />)} />
          <Route path='/reset/:token' element={<PassReset />} />
          <Route path='/unsubscribe/:token' element={<Unsubscribe />} />
          <Route path='/confirm/:token' element={<EmailConfirm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <ToastContainer />
      </main>
    </>
  )
}

export default App
