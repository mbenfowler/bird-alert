import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserExists, getIsCorrectPass, getUser, createUser } from '../../apiCalls'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Login.css'

const Login = () => {
    const { setUser, handleNetworkErrors } = useContext(BirdsContext)
    const [userFound, setUserFound] = useState()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [correctPass, setCorrectPass] = useState()
    const [isLoaded, setIsLoaded] = useState(true)

    const navigate = useNavigate();

    useEffect(() => {
      if (correctPass) {
        (async() => {
          setIsLoaded(false)
          try {
              const user = await getUser(email)
              setUser(user)
              navigate('/')
          } catch (error) {
              handleNetworkErrors(error)
          }
        })()
      }
    //eslint-disable-next-line
    }, [correctPass])

    const handleChange = (e) => {
      const field = e.target
      if (field.classList.contains('email')) setEmail(e.target.value)
      else if (field.classList.contains('password')) setPassword(e.target.value)
    }

    const handleEnter = async (e) => {
      const field = e.target

      if (e.key === 'Enter') {
        setIsLoaded(false)
        if (field.classList.contains('email')) {
          setCorrectPass(undefined)
          setPassword('')
          const passwordInput = document.querySelector('.password')
          if (passwordInput) {
            passwordInput.value = ''
          }
          await getUserExists(email)
            .then(res => setUserFound(res.userExists))
        } else if (field.classList.contains('password') && userFound) {
            await getIsCorrectPass(email, password)
              .then(res => {
                setCorrectPass(res.isCorrectPass)
              })
        } else if (field.classList.contains('password') && !userFound) {
          try {
            await createUser(email, password)
            const newUser = await getUser(email)
            setUser(newUser)
            navigate('/');
          } catch (error) {
            handleNetworkErrors(error)
          }
          // TODO: validations
          // TODO: confirm email flow
        }
        setIsLoaded(true)
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
              <div>
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
            {correctPass === false && <h3 className='info'>incorrect password</h3>}
            {isLoaded === false && <div className='spinner login-spinner'></div>}
          </section>
        </main>
    )
}

export default Login
