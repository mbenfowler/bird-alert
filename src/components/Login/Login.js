import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockEmailData } from './mockEmailData'
import './Login.css'

const Login = () => {
    const [user, setUser] = useState()
    const [userFound, setUserFound] = useState()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [correctPass, setCorrectPass] = useState()

    const navigate = useNavigate();

    const handleChange = (e) => {
      const field = e.target
      if (field.classList.contains('email')) setEmail(e.target.value)
      else if (field.classList.contains('password')) setPassword(e.target.value)
    }

    const handleEnter = (e) => {
      const field = e.target

      if (e.key === 'Enter' && field.classList.contains('email')) {
          console.log(email)
          //api call to login
          //if user exists, ask for password
          if (mockEmailData.find(user => user.email === email)) {
              setUserFound(true)
          } else {
            setUserFound(false)
          }
      } else if (e.key === 'Enter' && field.classList.contains('password') && userFound) {
          console.log('password entered')
          //api call to login
          //if password is correct, set user and redirect to main page
          const correctUserPass = mockEmailData.find(user => user.email === email && user.password === password)
          if (correctUserPass) {
            setUser(mockEmailData.find(user => user.email === email))
            setCorrectPass(true)
            navigate('/')
          } else {
            setCorrectPass(false)
          }
      }
    }

    return (
        <main className='login'>
          <section className='login-panel'>
            <div className='user-entry'>
              <h2>email</h2>
              <input className='input email' onChange={handleChange} onKeyDown={handleEnter}></input>
            </div>
            {
              userFound === false &&
              <div className='user-entry'>
                <h3 className='info'>Email not found!</h3>
                <p className='info'>Please make a password to continue creating an account for this email.</p>
              </div>
            }
            {
              userFound !== undefined &&
              <div className='user-entry'>
                <h2>enter password</h2>
                <input className='input password' type='password' onChange={handleChange} onKeyDown={handleEnter}></input>
              </div>
            }
            {
              correctPass === false &&
              <div className='user-entry'>
                <h3>incorrect password</h3>
              </div>
            }
          </section>
        </main>
    )
}

export default Login
