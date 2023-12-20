import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { patchUser } from '../../apiCalls'
import './EmailConfirm.css'

const EmailConfirm = () => {
  const { email } = useParams()
  const [userPatched, setUserPatched] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  useEffect(() => {
    (async() => {
      await patchUser(email, { email, confirmed: `${true}` })
      .then(() => setUserPatched(true))
      .catch(error => setNetworkError(error.message))
    })()
  }, [])

  const handleClick = () => {
    window.location.replace('/login')
  }

  return (
    <section>
      {!userPatched && !networkError && <h2>Confirming email...</h2>}
      {networkError && <>
                        <h2>Something went wrong:</h2>
                        <p>{networkError}</p>
                       </>}
      {userPatched && <section className='confirm-section'>
                        <h2>Email successfully confirmed!</h2>
                        <button onClick={handleClick}>Login here</button>
                      </section>}
    </section>
  )
}

export default EmailConfirm
