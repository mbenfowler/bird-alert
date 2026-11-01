import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { unsubscribe, errorMessage } from '../../apiCalls'
import { t } from '../../i18n'

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
      {status === 'pending' && <h2>{t('unsubscribe.working')}</h2>}
      {status === 'failed' &&
        <>
          <h2>{t('common.wentWrong')}</h2>
          <p>{error}</p>
          <Link to='/'><button>{t('common.returnHome')}</button></Link>
        </>}
      {status === 'done' &&
        <section className='confirm-section'>
          <h2>{t('unsubscribe.done')}</h2>
          <p>{t('unsubscribe.reenable')}</p>
          <Link to='/'><button>{t('common.returnHome')}</button></Link>
        </section>}
    </section>
  )
}

export default Unsubscribe
