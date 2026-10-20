import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { resetPassword } from '../../apiCalls'
import './PassReset.css'

const PASSWORD_MIN_LENGTH = 8

const PassReset = () => {
  const [passwordOne, setPasswordOne] = useState('')
  const [passwordTwo, setPasswordTwo] = useState('')
  const [error, setError] = useState(null)
  const [isBusy, setIsBusy] = useState(false)

  const { token } = useParams()
  const navigate = useNavigate()

  const tooShort = passwordOne.length > 0 && passwordOne.length < PASSWORD_MIN_LENGTH
  const mismatch = passwordTwo.length > 0 && passwordOne !== passwordTwo
  const canSubmit = passwordOne.length >= PASSWORD_MIN_LENGTH && passwordOne === passwordTwo && !isBusy

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setIsBusy(true)
    setError(null)
    try {
      await resetPassword(token, passwordOne)
      toast.success('Password has been reset! Please log in.', { position: 'bottom-center' })
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section>
      <form id='resetPasswordForm' onSubmit={handleSubmit}>
        <h1>Reset Password</h1>
        <label>
          New password:
          <input id='passwordOne' type='password' autoComplete='new-password' value={passwordOne} onChange={(e) => setPasswordOne(e.target.value)} />
        </label>
        <label>
          Retype password:
          <input id='passwordTwo' type='password' autoComplete='new-password' value={passwordTwo} onChange={(e) => setPasswordTwo(e.target.value)} />
        </label>
        {tooShort && <p className='passwordErrorText'>Password must be at least {PASSWORD_MIN_LENGTH} characters</p>}
        {mismatch && <p className='passwordErrorText'>Passwords do not match</p>}
        {error && <p className='passwordErrorText' role='alert'>{error}</p>}
        <button type='submit' id='confirmPasswordReset' disabled={!canSubmit}>Confirm password</button>
      </form>
    </section>
  )
}

export default PassReset
