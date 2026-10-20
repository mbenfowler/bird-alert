import { lazy, Suspense, useEffect, type ReactElement } from 'react'
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router'
import { ToastContainer } from 'react-toastify'
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

// Routes reachable without a session. Everything else redirects to /login once we know there is no user.
const PUBLIC_PATH_PREFIXES = ['/login', '/reset/', '/confirm/', '/unsubscribe/']

const App = () => {
  const session = useSessionQuery()
  // undefined while the cookie is being checked; null when logged out (or the API is unreachable).
  const user = session.isError ? null : session.data

  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isPublicPath = PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
  useEffect(() => {
    if (user === null && !isPublicPath) navigate('/login', { replace: true })
  }, [user, isPublicPath, navigate])

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
