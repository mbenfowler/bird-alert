import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import { resetPassword, errorMessage } from '../../apiCalls'
import './PassReset.css'
import { t } from '../../i18n'

const PASSWORD_MIN_LENGTH = 8

const PassReset = () => {
  const [passwordOne, setPasswordOne] = useState('')
  const [passwordTwo, setPasswordTwo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const tooShort = passwordOne.length > 0 && passwordOne.length < PASSWORD_MIN_LENGTH
  const mismatch = passwordTwo.length > 0 && passwordOne !== passwordTwo
  const canSubmit = passwordOne.length >= PASSWORD_MIN_LENGTH && passwordOne === passwordTwo && !isBusy

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    setIsBusy(true)
    setError(null)
    try {
      await resetPassword(token, passwordOne)
      toast.success(t('reset.done'), { position: 'bottom-center' })
      navigate('/login')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section>
      <form id='resetPasswordForm' onSubmit={handleSubmit}>
        <h1>{t('reset.title')}</h1>
        <label>
          {t('reset.new')}
          <input id='passwordOne' type='password' autoComplete='new-password' value={passwordOne} onChange={(e) => setPasswordOne(e.target.value)} />
        </label>
        <label>
          {t('reset.retype')}
          <input id='passwordTwo' type='password' autoComplete='new-password' value={passwordTwo} onChange={(e) => setPasswordTwo(e.target.value)} />
        </label>
        {tooShort && <p className='passwordErrorText'>{t('reset.tooShort', { count: PASSWORD_MIN_LENGTH })}</p>}
        {mismatch && <p className='passwordErrorText'>{t('reset.mismatch')}</p>}
        {error && <p className='passwordErrorText' role='alert'>{error}</p>}
        <button type='submit' id='confirmPasswordReset' disabled={!canSubmit}>{t('reset.confirm')}</button>
      </form>
    </section>
  )
}

export default PassReset
