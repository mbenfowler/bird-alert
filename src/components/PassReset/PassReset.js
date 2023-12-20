import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { patchUser } from '../../apiCalls'
import './PassReset.css'

const PassReset = () => {
  const [newPasswordOne, setNewPasswordOne] = useState('')
  const [newPasswordTwo, setNewPasswordTwo] = useState('')
  const [passwordsMatch, setPasswordsMatch] = useState(false)
  const [passwordTooShort, setPasswordTooShort] = useState()

  const { email } = useParams()
  
  useEffect(() => {
    if (newPasswordOne === newPasswordTwo && newPasswordOne.length > 3) setPasswordsMatch(true)
    else if (newPasswordOne !== newPasswordTwo) setPasswordsMatch(false)
  }, [newPasswordOne, newPasswordTwo])
  
  const handleChange = (e) => {
    if (e.target.id === 'passwordOne') setNewPasswordOne(e.target.value)
    else if (e.target.id === 'passwordTwo') setNewPasswordTwo(e.target.value)
  }

  const navigate = useNavigate()

  // might need to update toast so that it is actually dynamic based on result of api call
  const resolveAfter1Sec = new Promise(resolve => setTimeout(resolve, 500));
  const notify = () => {
      toast.promise(resolveAfter1Sec, {
        success: {
          render: 'Password has been reset!',
          position: 'bottom-center'
        }
      //   pending: {
      //     render: 'Updating zip code...',
      //     position: 'bottom-center'
      //   },
      //   error: {
      //     render: 'Something went wrong...',
      //     position: 'bottom-center'
      //   }
      });
  }
  
  const handleSubmit = async () => {
    if (newPasswordOne.length < 4) setPasswordTooShort(true)
    else if (passwordsMatch) {
      setPasswordTooShort(false)
      await patchUser({ email, password: newPasswordOne })
      notify()
      navigate('/')
    }
  }
  
  return (
    <section>
      <form id='resetPasswordForm'>
        <h1>Reset Password</h1>
        <label>
          New password:
          <input id='passwordOne' type='password' onChange={handleChange}/>
        </label>
        <label>
          Retype password:
          <input id='passwordTwo' type='password' onChange={handleChange}/>
        </label>
        {!passwordsMatch && newPasswordTwo.length > 3 && <p className='passwordErrorText'>Passwords do not match</p>}
        {passwordTooShort && <p className='passwordErrorText'>Password must be at least 4 characters</p>}
        <div id='confirmPasswordReset' onClick={handleSubmit}>Confirm password</div>
      </form>
    </section>
  )
}

export default PassReset
