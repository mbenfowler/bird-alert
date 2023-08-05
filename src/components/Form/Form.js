import { useState, useContext } from 'react'
import { Link } from 'react-router-dom'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Form.css'

const Form = () => {
    const { user, setUser, setBirds } = useContext(BirdsContext)

    const [form, setForm] = useState({
        name: user.name,
        location: user.location,
        emailAddress: user.emailAddress,
        phoneNumber: user.phoneNumber
    })

    const handleChange = (e) => {
        setForm(prev => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleSubmit = () => {
        setUser(form)
        if (!form.location.length) {
            setBirds([])
        }
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
            <Link to='/' onClick={handleSubmit}>Lock in details</Link>
        </form>
    )
}

export default Form