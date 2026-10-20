import { useEffect, type ReactElement } from 'react'
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useSessionQuery } from '../../hooks/queries'
import './App.css'
import Login from '../Login/Login'
import Nav from '../Nav/Nav'
import Home from '../Home/Home'
import Saved from '../Saved/Saved'
import Settings from '../Settings/Settings'
import EmailConfirm from '../EmailConfirm/EmailConfirm'
import Unsubscribe from '../Unsubscribe/Unsubscribe'
import PassReset from '../PassReset/PassReset'
import NotFound from '../NotFound/NotFound'

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
    </>
  )
}

export default App
