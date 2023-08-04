import { useState, useContext } from 'react'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Form.css'

const Form = () => {
    const { user, setUser } = useContext(BirdsContext)

    const [form, setForm] = useState({
        name: user.name,
        location: user.location,
        emailAddress: user.emailAddress,
        phoneNumber: user.phoneNumber
    })

    const handleChange = (e) => {
        setForm(prev => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleSubmit = (e) => {
        console.log(form)
        setUser(form)
        e.preventDefault()
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
                    <option value="US-GA-139">US-GA-139</option>
                    <option value="US-NV-510">US-NV-510</option>
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
            <button onClick={handleSubmit}>Lock in details</button>
        </form>
    )
}

export default Form