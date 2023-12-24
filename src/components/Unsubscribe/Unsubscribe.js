import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { patchUser } from '../../apiCalls'

const Unsubscribe = () => {
  const { email, emailType } = useParams()
  const [userPatched, setUserPatched] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  useEffect(() => {
    (async() => {
      await patchUser(email, { email, [emailType]: `${false}` })
      .then(() => setUserPatched(true))
      .catch(error => setNetworkError(error.message))
    })()
  //eslint-disable-next-line
  }, [])

  const handleClick = () => {
    window.location.replace('/login')
  }

  return (
    <section>
      {!userPatched && !networkError && <h2>Unsubscribing...</h2>}
      {networkError && <>
                        <h2>Something went wrong:</h2>
                        <p>{networkError}</p>
                        <button onClick={handleClick}>Return home</button>
                       </>}
      {userPatched && <section className='confirm-section'>
                        <h2>Successfully unsubscribed!</h2>
                        <p>You can reenable this digest from the Alert center located within your user settings</p>
                        <button onClick={handleClick}>Return home</button>
                      </section>}
    </section>
  )
}

export default Unsubscribe
