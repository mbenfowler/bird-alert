import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { unsubscribe } from '../../apiCalls'

const Unsubscribe = () => {
  const { token } = useParams()
  const [status, setStatus] = useState('pending')
  const [error, setError] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    unsubscribe(token)
      .then(() => setStatus('done'))
      .catch((err) => { setError(err.message); setStatus('failed') })
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
