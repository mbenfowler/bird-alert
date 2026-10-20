import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { unsubscribe, errorMessage } from '../../apiCalls'

type Status = 'pending' | 'done' | 'failed'

const Unsubscribe = () => {
  const { token = '' } = useParams<{ token: string }>()
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    unsubscribe(token)
      .then(() => setStatus('done'))
      .catch((err) => { setError(errorMessage(err)); setStatus('failed') })
  }, [token])

  return (
    <section>
      {status === 'pending' && <h2>Unsubscribing...</h2>}
      {status === 'failed' &&
        <>
          <h2>Something went wrong:</h2>
          <p>{error}</p>
          <Link to='/'><button>Return home</button></Link>
        </>}
      {status === 'done' &&
        <section className='confirm-section'>
          <h2>Successfully unsubscribed!</h2>
          <p>You can re-enable this digest from the Alert center within your user settings.</p>
          <Link to='/'><button>Return home</button></Link>
        </section>}
    </section>
  )
}

export default Unsubscribe
