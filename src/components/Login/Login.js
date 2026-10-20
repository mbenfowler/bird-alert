import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getUserExists, login, signup, requestPasswordReset } from '../../apiCalls'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Login.css'

const PASSWORD_MIN_LENGTH = 8

const Login = () => {
    const { user, setUser } = useContext(BirdsContext)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // undefined until the email has been looked up; then true (log in) or false (create account)
    const [userExists, setUserExists] = useState(undefined)
    const [error, setError] = useState(null)
    const [isBusy, setIsBusy] = useState(false)

    const navigate = useNavigate()

    // Already logged in? Nothing to do here.
    useEffect(() => {
      if (user) navigate('/', { replace: true })
    }, [user, navigate])

    const handleEmailChange = (e) => {
      setEmail(e.target.value)
      setUserExists(undefined)
      setPassword('')
      setError(null)
    }

    const submitEmail = async (e) => {
      e.preventDefault()
      if (!email.trim()) return
      setIsBusy(true)
      setError(null)
      try {
        const result = await getUserExists(email.trim())
        setUserExists(result.userExists)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsBusy(false)
      }
    }

    const submitPassword = async (e) => {
      e.preventDefault()
      if (!userExists && password.length < PASSWORD_MIN_LENGTH) {
        setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
        return
      }
      setIsBusy(true)
      setError(null)
      try {
        const loggedIn = userExists ? await login(email.trim(), password) : await signup(email.trim(), password)
        setUser(loggedIn)
        navigate('/')
      } catch (err) {
        setError(err.message)
      } finally {
        setIsBusy(false)
      }
    }

    const handleForgotPassword = () => {
      toast.promise(requestPasswordReset(email.trim()), {
        pending: { render: 'Sending password reset email...', position: 'bottom-center' },
        success: { render: 'Password reset email sent!', position: 'bottom-center' },
        error: { render: ({ data }) => data?.message || 'Something went wrong', position: 'bottom-center' }
      })
    }

    return (
        <main className='login'>
          <section className='login-panel'>
            <form className='user-entry' onSubmit={submitEmail}>
              <h2>email</h2>
              <input className='input email' type='email' name='email' autoComplete='email' value={email} onChange={handleEmailChange} autoFocus />
              {userExists &&
                <button type='button' className='link-button password-reset-text' onClick={handleForgotPassword}>
                  Click here to receive a password reset email
                </button>}
            </form>
            {userExists === false &&
              <div>
                <h3 className='info'>Email not found!</h3>
                <p className='info'>Please make a password (at least {PASSWORD_MIN_LENGTH} characters) to create an account for this email.</p>
              </div>}
            {userExists !== undefined &&
              <form className='user-entry' onSubmit={submitPassword}>
                <h2>{userExists ? 'enter password' : 'create password'}</h2>
                <input className='input password' type='password' name='password' autoComplete={userExists ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </form>}
            {error && <h3 className='info' role='alert'>{error}</h3>}
            {isBusy && <div className='spinner login-spinner'></div>}
          </section>
        </main>
    )
}

export default Login
