import { useState } from 'react'
import './Form.css'

const Form = () => {
    const [form, setForm] = useState({
        name: "",
        location: "",
        emailAddress: "",
        phoneNumber: ""
    })

    const [user, setUser] = useState([])
    
    const handleChange = (e) => {
        setForm(prev => ({...prev, [e.target.name]: e.target.value}))
    }

    const handleSubmit = (e) => {
        console.log(form)
        setUser(prev => ([...prev, form]))
        e.preventDefault()
    }

    console.log(user)

    return (
        <form>
            <label>
                Name:
                <input type="text" name='name' value={form.name} onChange={handleChange} />
            </label>
            <label>
                Location:
                <select name="location" value={form.location} onChange={handleChange}>
                    <option value="US-GA-139">US-GA-139</option>
                    <option value="US-GA-140">US-GA-140</option>
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