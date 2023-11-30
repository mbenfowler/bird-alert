import { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { patchUser, getUser, getExternalRegions, getPasswordResetEmail } from '../../apiCalls'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Form.css'

const STATE_CODES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

const Form = ({ isLoaded }) => {
    const { user, setBirds, setIsLoaded, setUser } = useContext(BirdsContext)
    const [regions, setRegions] = useState([])
    const [form, setForm] = useState({
        name:       `${user?.name ? user.name : ''}`,
        state:      `${user?.state ? user.state : ''}`,
        location:   `${user?.location ? user.location : ''}`,
        email:      `${user?.email ? user.email : ''}`,
        phone:      `${user?.phone ? user.phone : ''}`
    })

    const resolveAfter1Sec = new Promise(resolve => setTimeout(resolve, 1000));
    const notify = () => {
        toast.promise(resolveAfter1Sec, {
          success: {
            render: 'Password reset email sent!',
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

    useEffect(() => {
        if (form.state.length) {
            (async() => {
                setRegions(await getExternalRegions(form.state))
            })()
        } else {
            setRegions([])
            setForm(prev => ({...prev, location: ''}))
        }
    //eslint-disable-next-line
    }, [form.state])

    const handleChange = (e) => {
        setForm(prev => ({...prev, [e.target.name]: e.target.value}))
    }

    const navigate = useNavigate()

    const handleClick = () => {
        getPasswordResetEmail(user.email)
        notify()
    }

    const handleSubmit = async () => {
        setIsLoaded(false)
        await patchUser(form)
            .then(async res => {
                setUser(await getUser(form.email))
            })
        if (!form.location.length) {
            setBirds([])
        }

        navigate('/');
    }

    return (
        <>
            {!isLoaded
                ? <div className='spinner'></div>
                : <form id='settings-form'>
                    {/* <label>
                        Name:
                        <input type="text" name='name' value={form.name} onChange={handleChange} />
                    </label> */}
                    <label id='emailLabel'>
                        Email:
                        <input type="text" name='email' value={form.email} onChange={handleChange} />
                        <p className='password-reset-text' onClick={handleClick}>Click here to receive a password reset email</p>
                    </label>
                    <label>
                        State:
                        <select name="state" value={form.state} onChange={handleChange}>
                            <option value="">Select your state</option>
                            {STATE_CODES.map(state => <option key={state} value={state}>{state}</option>)}
                        </select>
                    </label>
                        {!!regions.length &&
                            <label>
                                Region:
                                <select name="location" value={form.location} onChange={handleChange}>
                                    <option value="">Select your region</option>
                                    {regions.map(region => <option key={region.code} value={region.code}>{region.name} - {region.code}</option>)}
                                </select>
                            </label>
                        }
                    <label>
                        Phone #:
                        <input type="text" name='phone' value={form.phone} onChange={handleChange} />
                    </label>
                    <div className='submit' onClick={handleSubmit}>Lock in details</div>
                </form>
            }
        </>
    )
}

export default Form
