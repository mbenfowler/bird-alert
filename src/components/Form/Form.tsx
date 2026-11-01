import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { resendConfirmationEmail, requestPasswordReset, errorMessage } from '../../apiCalls'
import { useCurrentUser, useNameLocalesQuery, useRegionsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { countyName, countyWord, stateName } from '../../usStates'
import AreaPicker from '../AreaPicker/AreaPicker'
import './Form.css'
import { t } from '../../i18n'

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
            pending: { render: t('account.sendingConfirm'), ...toastAt },
            success: { render: t('account.confirmSent'), ...toastAt },
            error: { render: ({ data }) => errorMessage(data), ...toastAt }
        })
    }

    const handlePasswordReset = () => {
        toast.promise(requestPasswordReset(user.email), {
            pending: { render: t('account.sendingReset'), ...toastAt },
            success: { render: t('account.resetSent'), ...toastAt },
            error: { render: ({ data }) => errorMessage(data), ...toastAt }
        })
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        patchUser.mutate(form, {
            onSuccess: (updated) => {
                if (updated.email !== user.email) {
                    toast.info(t('account.emailChanged'), toastAt)
                }
                toast.success(t('account.saved'), toastAt)
                navigate('/')
            },
            onError: (error) => toast.error(errorMessage(error), toastAt)
        })
    }

    // The language saves on its own, at once: bird names switch straight away.
    const languages = useNameLocalesQuery()
    const setLanguage = (value: string) => patchUser.mutate({ locale: value || null }, {
        onSuccess: () => toast.success(t('account.languageSaved'), toastAt),
        onError: (error) => toast.error(errorMessage(error), toastAt)
    })

    if (patchUser.isPending) return <div className='spinner'></div>

    return (
        <form id='settings-form' className='settings-card' onSubmit={handleSubmit}>
            <h2 className='fredericka'>{t('account.title')}</h2>
            {!user.email_confirmed &&
                <p className='settings-card__warning' role='status'>
                    {t('account.pleaseConfirm')}{' '}
                    <button type='button' className='link-button link-text' id='resendConfirmationEmail' onClick={handleResendConfirmation}>{t('account.resend')}</button>
                </p>
            }
            <label className='field' id='emailLabel'>
                <span className='field__label'>{t('account.email')}</span>
                <input type="email" name='email' autoComplete='email' value={form.email} onChange={handleChange} />
            </label>
            <button type='button' className='link-button password-reset-text' id='sendPasswordResetEmail' onClick={handlePasswordReset}>{t('account.resetLink')}</button>
            <div className='field'>
                <span className='field__label'>{t('account.where')}</span>
                {!changingArea && (
                    <p className='settings-card__area'>
                        <strong data-testid='current-area'>{areaLabel || (form.location ? form.location : t('account.noArea', { word: countyWord(form.state || 'GA') }))}</strong>{' '}
                        <button type='button' className='link-button link-text' onClick={() => setChangingArea(true)}>{t('common.change')}</button>
                    </p>
                )}
                {changingArea && (
                    <AreaPicker current={form.location ? { state: form.state, location: form.location } : null}
                        onPick={(area) => { setForm(prev => ({ ...prev, state: area.state, location: area.location })); setPickedLabel(area.label); setChangingArea(false) }} />
                )}
            </div>
            <label className='field'>
                <span className='field__label'>{t('account.language')}</span>
                <select className='select' name='locale' value={user.locale ?? ''} onChange={(e) => setLanguage(e.target.value)}>
                    <option value=''>{t('account.languageBrowser')}</option>
                    {(languages.data ?? []).map(l => <option key={l.locale} value={l.locale}>{l.name}</option>)}
                </select>
                <span className='field__hint'>{t('account.languageHint')}</span>
            </label>
            <div className='settings-card__actions'>
                <button type='submit' className='pill-button pill-button--primary'>{t('account.lockIn')}</button>
            </div>
        </form>
    )
}

export default Form
