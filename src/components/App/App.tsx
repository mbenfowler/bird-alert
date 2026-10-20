import { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react'
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { getCurrentUser, logout as apiLogout, getBirdKeysByLocation, getBirdsData, getSavedBirds, getBirdObservationsByLocation, errorMessage } from '../../apiCalls'
import type { Bird, Observation } from '../../types'
import './App.css'
import Login from '../Login/Login'
import Nav from '../Nav/Nav'
import ErrorMessage from '../Error/ErrorMessage'
import Home from '../Home/Home'
import Saved from '../Saved/Saved'
import Settings from '../Settings/Settings'
import EmailConfirm from '../EmailConfirm/EmailConfirm'
import Unsubscribe from '../Unsubscribe/Unsubscribe'
import PassReset from '../PassReset/PassReset'
import NotFound from '../NotFound/NotFound'
import BirdsContext, { type BirdsContextValue, type SessionUser } from '../BirdsContext/BirdsContext'

const RESULTS_PER_PAGE = 5

// Routes reachable without a session. Everything else redirects to /login once we know there is no user.
const PUBLIC_PATH_PREFIXES = ['/login', '/reset/', '/confirm/', '/unsubscribe/']

const App = () => {
  const [user, setUser] = useState<SessionUser>(undefined)
  const [birds, setBirds] = useState<Bird[]>([])
  const [savedBirds, setSavedBirds] = useState<Bird[]>([])
  const [recentObservations, setRecentObservations] = useState<Observation[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [isLoaded, setIsLoaded] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleNetworkErrors = useCallback((error: unknown) => setNetworkError(errorMessage(error)), [])

  const logout = useCallback(async () => {
    try { await apiLogout() } catch { /* the cookie is gone either way */ }
    setUser(null)
    setBirds([])
    setSavedBirds([])
    setRecentObservations([])
    setNetworkError(null)
  }, [])

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false
    getCurrentUser()
      .then(current => { if (!cancelled) setUser(current) })
      .catch(() => { if (!cancelled) setUser(null) })
    return () => { cancelled = true }
  }, [])

  // Send logged-out visitors to /login, but leave the email-link routes and 404s alone.
  const isPublicPath = PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
  useEffect(() => {
    if (user === null && !isPublicPath) navigate('/login', { replace: true })
  }, [user, isPublicPath, navigate])

  const userId = user?.id
  const region = user?.location

  // Start from page one whenever the region changes.
  useEffect(() => { setCurrentPage(1) }, [region])

  // Watch list and recent sightings for the region.
  useEffect(() => {
    if (!userId || !region) return
    let cancelled = false
    ;(async () => {
      try {
        const [saved, observations] = await Promise.all([getSavedBirds(), getBirdObservationsByLocation(region)])
        if (cancelled) return
        setSavedBirds(saved)
        setRecentObservations(observations)
      } catch (error) {
        if (!cancelled) handleNetworkErrors(error)
      }
    })()
    return () => { cancelled = true }
  }, [userId, region, handleNetworkErrors])

  // One page of the region's species list, enriched into full bird records.
  useEffect(() => {
    if (!userId || !region) return
    let cancelled = false
    setIsLoaded(false)
    ;(async () => {
      try {
        const keys = await getBirdKeysByLocation(region)
        if (cancelled) return
        setPageCount(Math.max(1, Math.ceil(keys.length / RESULTS_PER_PAGE)))
        const start = (currentPage - 1) * RESULTS_PER_PAGE
        const pageBirds = await getBirdsData(keys.slice(start, start + RESULTS_PER_PAGE))
        if (cancelled) return
        setBirds(pageBirds)
        setIsLoaded(true)
      } catch (error) {
        if (!cancelled) handleNetworkErrors(error)
      }
    })()
    return () => { cancelled = true }
  }, [userId, region, currentPage, handleNetworkErrors])

  const savedCodes = useMemo(() => new Set(savedBirds.map(bird => bird.speciesCode)), [savedBirds])
  const birdAlerts = useMemo(
    () => recentObservations.filter(obs => savedCodes.has(obs.speciesCode)),
    [recentObservations, savedCodes]
  )

  const contextValue: BirdsContextValue = {
    user, setUser, logout,
    birds, savedBirds, setSavedBirds, savedCodes,
    recentObservations, birdAlerts,
    currentPage, setCurrentPage, pageCount,
    isLoaded, handleNetworkErrors
  }

  // Gate an element on having a user. While the session is being checked, show a spinner.
  const requireUser = (element: ReactElement) => {
    if (user === undefined) return <div className='spinner'></div>
    if (user === null) return null
    return element
  }

  const home = networkError
    ? <ErrorMessage networkError={networkError} />
    : user?.location
      ? <Home />
      : <section id='init'>
          <p id='initText'>Go to settings and set a location</p>
          <Link to='/settings'><button className='navigate-button'>Go to settings</button></Link>
        </section>

  return (
    <BirdsContext.Provider value={contextValue}>
      <Nav setNetworkError={setNetworkError}/>
      <main className="App">
        <Routes>
          <Route path='/' element={requireUser(home)} />
          <Route path='/login' element={<Login />} />
          <Route path='/saved' element={requireUser(<Saved />)} />
          <Route path='/settings' element={requireUser(<Settings />)} />
          <Route path='/reset/:token' element={<PassReset />} />
          <Route path='/unsubscribe/:token' element={<Unsubscribe />} />
          <Route path='/confirm/:token' element={<EmailConfirm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ToastContainer />
      </main>
    </BirdsContext.Provider>
  )
}

export default App
