import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchUser } from '../../apiCalls'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Form.css'

const Form = () => {
    const { user, setBirds, setIsLoaded } = useContext(BirdsContext)
    const [form, setForm] = useState({
        name: `${user?.name ? user.name : ''}`,
        location: `${user?.location ? user.location : ''}`,
        emailAddress: `${user?.email ? user.email : ''}`,
        phoneNumber: `${user?.phone ? user.phone : ''}`
    })

    const handleChange = (e) => {
        setForm(prev => ({...prev, [e.target.name]: e.target.value}))
    }

    const navigate = useNavigate()

    const handleSubmit = async () => {
        await patchUser(form)
        setIsLoaded(false)
        if (!form.location.length) {
            setBirds([])
        }

        navigate('/');
    }

    return (
        <form>
            <label>
                Name:
                <input type="text" name='name' value={form.name} onChange={handleChange} />
            </label>
            <label>
                Location:
                <select name="location" value={form.location} onChange={handleChange}>
                    <option value="">Select your region</option>
                    <option value="US-GA-139">Gainesville, GA</option>
                    <option value="US-NV-510">Carson City, NV</option>
                </select>
            </label>
            <label>
                Email:
                <input type="text" name='emailAddress' value={form.emailAddress} onChange={handleChange} />
            </label>
            <label>
                Phone #:
                <input type="text" name='phoneNumber' value={form.phoneNumber} onChange={handleChange} />
            </label>
            <div className='submit' onClick={handleSubmit}>Lock in details</div>
        </form>
    )
}

export default Form
