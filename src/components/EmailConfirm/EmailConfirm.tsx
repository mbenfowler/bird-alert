import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { confirmEmail, errorMessage } from '../../apiCalls'
import './EmailConfirm.css'

type Status = 'pending' | 'done' | 'failed'

const EmailConfirm = () => {
  const { token = '' } = useParams<{ token: string }>()
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    confirmEmail(token)
      .then(() => setStatus('done'))
      .catch((err) => { setError(errorMessage(err)); setStatus('failed') })
  }, [token])

  return (
    <section>
      {status === 'pending' && <h2>Confirming email...</h2>}
      {status === 'failed' &&
        <>
          <h2>Something went wrong:</h2>
          <p>{error}</p>
          <Link to='/login'><button>Return home</button></Link>
        </>}
      {status === 'done' &&
        <section className='confirm-section'>
          <h2>Email successfully confirmed!</h2>
          <Link to='/'><button>Continue</button></Link>
        </section>}
    </section>
  )
}

export default EmailConfirm
