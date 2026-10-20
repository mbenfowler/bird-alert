import { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { patchUser, getExternalRegions, resendConfirmationEmail, requestPasswordReset } from '../../apiCalls'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Form.css'

const STATE_CODES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

const toastAt = { position: 'bottom-center' }

const Form = () => {
    const { user, setUser, handleNetworkErrors } = useContext(BirdsContext)
    const [regions, setRegions] = useState([])
    const [isSaving, setIsSaving] = useState(false)
    const [form, setForm] = useState({
        state:    user.state || '',
        location: user.location || '',
        email:    user.email || '',
        phone:    user.phone || ''
    })

    // Region options follow the selected state. Clearing the state clears the region too.
    useEffect(() => {
        if (!form.state) {
            setRegions([])
            setForm(prev => (prev.location ? { ...prev, location: '' } : prev))
            return
        }
        let cancelled = false
        getExternalRegions(form.state)
            .then(result => { if (!cancelled) setRegions(result) })
            .catch(error => { if (!cancelled) handleNetworkErrors(error) })
        return () => { cancelled = true }
    }, [form.state, handleNetworkErrors])

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const navigate = useNavigate()

    const handleResendConfirmation = () => {
        toast.promise(resendConfirmationEmail(), {
            pending: { render: 'Sending confirmation email...', ...toastAt },
            success: { render: 'Confirmation email sent!', ...toastAt },
            error: { render: ({ data }) => data?.message || 'Something went wrong', ...toastAt }
        })
    }

    const handlePasswordReset = () => {
        toast.promise(requestPasswordReset(user.email), {
            pending: { render: 'Sending password reset email...', ...toastAt },
            success: { render: 'Password reset email sent!', ...toastAt },
            error: { render: ({ data }) => data?.message || 'Something went wrong', ...toastAt }
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const updated = await patchUser(form)
            setUser(updated)
            if (updated.email !== user.email) {
                toast.info('Email changed. Check your inbox for a new confirmation link.', toastAt)
            }
            toast.success('Settings saved!', toastAt)
            navigate('/')
        } catch (error) {
            toast.error(error.message, toastAt)
        } finally {
            setIsSaving(false)
        }
    }

    if (isSaving) return <div className='spinner'></div>

    return (
        <form id='settings-form' onSubmit={handleSubmit}>
            {!user.email_confirmed &&
                <>
                    <p className='email-confirmation-text'>Please confirm your email address to receive notifications</p>
                    <button type='button' className='link-button link-text' id='resendConfirmationEmail' onClick={handleResendConfirmation}>Resend confirmation email</button>
                </>
            }
            <label id='emailLabel'>
                Email:
                <input type="email" name='email' autoComplete='email' value={form.email} onChange={handleChange} />
                <button type='button' className='link-button password-reset-text' id='sendPasswordResetEmail' onClick={handlePasswordReset}>Click here to receive a password reset email</button>
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
                <input type="tel" name='phone' autoComplete='tel' value={form.phone} onChange={handleChange} />
            </label>
            <button type='submit' className='submit'>Lock in details</button>
        </form>
    )
}

export default Form
