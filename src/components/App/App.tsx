import { Suspense, useEffect, useRef, type ReactElement } from 'react'
import { lazyWithReload as lazy } from '../../lazyRetry'
import RouteError from '../RouteError/RouteError'
import { Routes, Route, useNavigate, useLocation, useNavigationType, Link } from 'react-router'
import { CHANNEL, decidePending, pollInterval, samePath, takePendingOpen, type LatestPush, type PendingTrigger } from '../../notificationHandoff'
import { ackPendingPush, getPendingPush, postPushTrace } from '../../apiCalls'
import type { PendingPush } from '../../types'

// Which build is running, for the notification trace.
const APP_BUILD = '2026-10-22.9'
import { toast, ToastContainer } from 'react-toastify'
import InstallNudge from '../InstallNudge/InstallNudge'
import ConfirmNudge from '../ConfirmNudge/ConfirmNudge'
import PullToRefresh from '../PullToRefresh/PullToRefresh'
import { prefersReducedMotion } from '../../routeDraw'
import { claimThisDevice } from '../../hooks/usePushNotifications'
import { soundTheAlarm } from '../../alertMode'
import { useSessionQuery } from '../../hooks/queries'
import './App.css'
import Login from '../Login/Login'
import Nav from '../Nav/Nav'
import Home from '../Home/Home'
import NotFound from '../NotFound/NotFound'
import { LoadingState } from '../Loading/Loading'

// Everything off the main path loads on demand, keeping the first visit light.
const Saved = lazy(() => import('../Saved/Saved'))
const LifeListPage = lazy(() => import('../LifeListPage/LifeListPage'))
const Settings = lazy(() => import('../Settings/Settings'))
const EmailConfirm = lazy(() => import('../EmailConfirm/EmailConfirm'))
const Unsubscribe = lazy(() => import('../Unsubscribe/Unsubscribe'))
const PassReset = lazy(() => import('../PassReset/PassReset'))
const Sighting = lazy(() => import('../Sighting/Sighting'))
const MapPage = lazy(() => import('../MapPage/MapPage'))
const AlertSightings = lazy(() => import('../AlertSightings/AlertSightings'))
const WhereToGo = lazy(() => import('../WhereToGo/WhereToGo'))
const Landing = lazy(() => import('../Landing/Landing'))
const Shared = lazy(() => import('../Shared/Shared'))
const Onboarding = lazy(() => import('../Onboarding/Onboarding'))

// Routes reachable without a session. Everything else redirects to /login once we know there is no user.
const PUBLIC_PATH_PREFIXES = ['/login', '/reset/', '/confirm/', '/unsubscribe/', '/share/']

const App = () => {
  const session = useSessionQuery()
  // undefined while the cookie is being checked; null when logged out (or the API is unreachable).
  const user = session.isError ? null : session.data

  const navigate = useNavigate()
  const { pathname } = useLocation()
  // useNavigate hands out a new function on every route change; the hand-off effect must not restart with it.
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  // The front door is public too: someone without an account sees the splash page there.
  const isPublicPath = pathname === '/' || PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
  // A new page starts at the top. Back/forward (POP) and in-place swaps (REPLACE, used when a pin
  // on a sighting's map picks another report) keep the reader where they were.
  const navigationType = useNavigationType()
  useEffect(() => {
    if (navigationType === 'PUSH') window.scrollTo(0, 0)
  }, [pathname, navigationType])

  // Moving to another page fades the new one in (a sighting swapping for another stays put). An
  // animation on the element, not a remount, so nothing reloads; opacity only, since a transform
  // would knock the pages' fixed and sticky parts loose while it runs. Reduced motion: no fade.
  const routeView = useRef<HTMLDivElement>(null)
  const section = pathname.split('/')[1] ?? ''
  const firstSection = useRef(section)
  useEffect(() => {
    const el = routeView.current
    if (!el || section === firstSection.current) return
    firstSection.current = section
    el.dataset.lastTransition = `/${section}`
    if (prefersReducedMotion() || !el.animate) return
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' })
  }, [section])
  useEffect(() => {
    if (user === null && !isPublicPath) navigate('/login', { replace: true })
  }, [user, isPublicPath, navigate])
  // This browser's notifications go to whoever is signed in now, not to whoever turned them on.
  const signedInId = user?.id
  useEffect(() => {
    if (signedInId) void claimThisDevice().catch(() => undefined)
  }, [signedInId])
  // A new account goes through the short setup once. Only an explicit null (setup not yet done)
  // counts: an account the server doesn't mark either way is left alone.
  const needsSetup = Boolean(user) && user?.onboarded_at === null
  useEffect(() => {
    if (needsSetup && pathname !== '/welcome' && !pathname.startsWith('/share/') && !pathname.startsWith('/confirm/') && !pathname.startsWith('/unsubscribe/')) navigate('/welcome', { replace: true })
  }, [needsSetup, pathname, navigate])

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
    let lastAlarmed: string | null = null
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
      // Once per alert, however many times it is offered.
      if (push.path !== lastAlarmed) { lastAlarmed = push.path; soundTheAlarm(push.title) }
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
        <ConfirmNudge />
        <div className='route-view' ref={routeView}>
        <RouteError resetKey={pathname}>
        <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path='/' element={user === null ? <Landing /> : requireUser(home)} />
          <Route path='/login' element={<Login />} />
          <Route path='/saved' element={requireUser(<Saved />)} />
          <Route path='/life-list' element={requireUser(<LifeListPage />)} />
          <Route path='/settings' element={requireUser(<Settings />)} />
          <Route path='/map' element={requireUser(<MapPage />)} />
          <Route path='/sighting/:code/:subId' element={requireUser(<Sighting />)} />
          <Route path='/sightings' element={requireUser(<AlertSightings />)} />
          <Route path='/go' element={requireUser(<WhereToGo />)} />
          <Route path='/share/:kind/:id' element={<Shared />} />
          <Route path='/welcome' element={requireUser(<Onboarding />)} />
          <Route path='/reset/:token' element={<PassReset />} />
          <Route path='/unsubscribe/:token' element={<Unsubscribe />} />
          <Route path='/confirm/:token' element={<EmailConfirm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </RouteError>
        </div>
        <ToastContainer />
        {user && <PullToRefresh />}
        <div className='alarm-glow' aria-hidden='true' />
        {user && <InstallNudge />}
      </main>
    </>
  )
}

export default App
