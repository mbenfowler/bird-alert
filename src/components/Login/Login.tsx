import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { getUserExists, login, signup, requestPasswordReset, errorMessage } from '../../apiCalls'
import { useSessionQuery } from '../../hooks/queries'
import { useSetSession } from '../../hooks/mutations'
import './Login.css'

const PASSWORD_MIN_LENGTH = 8

const Login = () => {
    const { data: user } = useSessionQuery()
    const setSession = useSetSession()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // undefined until the email has been looked up; then true (log in) or false (create account)
    const [userExists, setUserExists] = useState<boolean | undefined>(undefined)
    const [error, setError] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)

    const navigate = useNavigate()

    // Already logged in? Nothing to do here.
    useEffect(() => {
      if (user) navigate('/', { replace: true })
    }, [user, navigate])

    const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value)
      setUserExists(undefined)
      setPassword('')
      setError(null)
    }

    const submitEmail = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!email.trim()) return
      setIsBusy(true)
      setError(null)
      try {
        const result = await getUserExists(email.trim())
        setUserExists(result.userExists)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setIsBusy(false)
      }
    }

    const submitPassword = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!userExists && password.length < PASSWORD_MIN_LENGTH) {
        setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
        return
      }
      setIsBusy(true)
      setError(null)
      try {
        const loggedIn = userExists ? await login(email.trim(), password) : await signup(email.trim(), password)
        setSession(loggedIn)
        navigate('/')
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setIsBusy(false)
      }
    }

    const handleForgotPassword = () => {
      toast.promise(requestPasswordReset(email.trim()), {
        pending: { render: 'Sending password reset email...', position: 'bottom-center' },
        success: { render: 'Password reset email sent!', position: 'bottom-center' },
        error: { render: ({ data }) => errorMessage(data), position: 'bottom-center' }
      })
    }

    return (
        <main className='login'>
          <section className='login-panel'>
            <form className='user-entry' onSubmit={submitEmail}>
              <h2 id='loginEmailLabel'>email</h2>
              <input className='input email' type='email' name='email' autoComplete='email' aria-labelledby='loginEmailLabel' value={email} onChange={handleEmailChange} autoFocus />
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
                <h2 id='loginPasswordLabel'>{userExists ? 'enter password' : 'create password'}</h2>
                <input className='input password' type='password' name='password' autoComplete={userExists ? 'current-password' : 'new-password'} aria-labelledby='loginPasswordLabel' value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </form>}
            {error && <h3 className='info' role='alert'>{error}</h3>}
            {isBusy && <div className='spinner login-spinner'></div>}
          </section>
        </main>
    )
}

export default Login
