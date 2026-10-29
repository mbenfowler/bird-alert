import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { resendConfirmationEmail, requestPasswordReset, errorMessage } from '../../apiCalls'
import { useCurrentUser, useRegionsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { countyLabel, countyWord } from '../../usStates'
import StateOptions from '../StateOptions/StateOptions'
import './Form.css'

const toastAt = { position: 'bottom-center' } as const

const Form = () => {
    const user = useCurrentUser()
    const patchUser = usePatchUserMutation()
    const navigate = useNavigate()
    const [form, setForm] = useState({
        state:    user.state || '',
        location: user.location || '',
        email:    user.email || ''
    })

    // Region options follow the selected state (cached for a week per state).
    const regions = useRegionsQuery(form.state)

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        // A new state invalidates the old region.
        setForm(prev => (name === 'state' ? { ...prev, state: value, location: '' } : { ...prev, [name]: value }))
    }

    const handleResendConfirmation = () => {
        toast.promise(resendConfirmationEmail(), {
            pending: { render: 'Sending confirmation email...', ...toastAt },
            success: { render: 'Confirmation email sent!', ...toastAt },
            error: { render: ({ data }) => errorMessage(data), ...toastAt }
        })
    }

    const handlePasswordReset = () => {
        toast.promise(requestPasswordReset(user.email), {
            pending: { render: 'Sending password reset email...', ...toastAt },
            success: { render: 'Password reset email sent!', ...toastAt },
            error: { render: ({ data }) => errorMessage(data), ...toastAt }
        })
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        patchUser.mutate(form, {
            onSuccess: (updated) => {
                if (updated.email !== user.email) {
                    toast.info('Email changed. Check your inbox for a new confirmation link.', toastAt)
                }
                toast.success('Settings saved!', toastAt)
                navigate('/')
            },
            onError: (error) => toast.error(errorMessage(error), toastAt)
        })
    }

    if (patchUser.isPending) return <div className='spinner'></div>

    return (
        <form id='settings-form' className='settings-card' onSubmit={handleSubmit}>
            <h2 className='fredericka'>Your details</h2>
            {!user.email_confirmed &&
                <p className='settings-card__warning' role='status'>
                    Please confirm your email address to receive notifications.{' '}
                    <button type='button' className='link-button link-text' id='resendConfirmationEmail' onClick={handleResendConfirmation}>Resend confirmation email</button>
                </p>
            }
            <label className='field' id='emailLabel'>
                <span className='field__label'>Email</span>
                <input type="email" name='email' autoComplete='email' value={form.email} onChange={handleChange} />
            </label>
            <button type='button' className='link-button password-reset-text' id='sendPasswordResetEmail' onClick={handlePasswordReset}>Send me a password reset email</button>
            <label className='field'>
                <span className='field__label'>State or province</span>
                <select name="state" value={form.state} onChange={handleChange}>
                    <option value="">Select your state or province</option>
                    <StateOptions />
                </select>
            </label>
            {regions.isError && <p className='passwordErrorText' role='alert'>Could not load regions: {errorMessage(regions.error)}</p>}
            {!!regions.data?.length &&
                <label className='field'>
                    <span className='field__label'>{countyLabel(form.state)}</span>
                    <select name="location" value={form.location} onChange={handleChange}>
                        <option value="">Select your {countyWord(form.state)}</option>
                        {regions.data.map(region => <option key={region.code} value={region.code}>{region.name} - {region.code}</option>)}
                    </select>
                </label>
            }
            <div className='settings-card__actions'>
                <button type='submit' className='pill-button pill-button--primary'>Lock in details</button>
            </div>
        </form>
    )
}

export default Form
