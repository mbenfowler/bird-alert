import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { resendConfirmationEmail, requestPasswordReset, errorMessage } from '../../apiCalls'
import { useCurrentUser, useRegionsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { countyName, countyWord, stateName } from '../../usStates'
import AreaPicker from '../AreaPicker/AreaPicker'
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

    // The area is shown by name ("Hall County, Georgia") and changed through the area picker.
    const regions = useRegionsQuery(form.state)
    const [changingArea, setChangingArea] = useState(false)
    const [pickedLabel, setPickedLabel] = useState<string | null>(null)
    const currentName = regions.data?.find(r => r.code === form.location)?.name
    const areaLabel = pickedLabel ?? (currentName ? [countyName(currentName, form.state), stateName(form.state)].filter(Boolean).join(', ') : null)

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
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
            <div className='field'>
                <span className='field__label'>Where you bird</span>
                {!changingArea && (
                    <p className='settings-card__area'>
                        <strong data-testid='current-area'>{areaLabel || (form.location ? form.location : `No ${countyWord(form.state || 'GA')} chosen yet`)}</strong>{' '}
                        <button type='button' className='link-button link-text' onClick={() => setChangingArea(true)}>Change</button>
                    </p>
                )}
                {changingArea && (
                    <AreaPicker current={form.location ? { state: form.state, location: form.location } : null}
                        onPick={(area) => { setForm(prev => ({ ...prev, state: area.state, location: area.location })); setPickedLabel(area.label); setChangingArea(false) }} />
                )}
            </div>
            <div className='settings-card__actions'>
                <button type='submit' className='pill-button pill-button--primary'>Lock in details</button>
            </div>
        </form>
    )
}

export default Form
