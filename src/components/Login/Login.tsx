import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { getUserExists, login, signup, requestPasswordReset, errorMessage } from '../../apiCalls'
import { useRegionsQuery, useSessionQuery } from '../../hooks/queries'
import { useSetSession } from '../../hooks/mutations'
import { addPasskey, cancelPasskeyAutofill, isDeviceLock, passkeysSupported, signInWithPasskey, unlockName, wasCancelled } from '../../passkeys'
import { countyName as fullCountyName, countyWord, stateName as fullStateName, stateOfRegion } from '../../usStates'
import AreaPicker from '../AreaPicker/AreaPicker'
import type { User } from '../../types'
import './Login.css'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

const PASSWORD_MIN_LENGTH = 8
const OFFER_DISMISSED_KEY = 'bird-alert:passkey-offer-dismissed'
const LANDING_REGION_KEY = 'bird-alert:landing-region'

const readLandingCounty = () => {
  try { const v = localStorage.getItem(LANDING_REGION_KEY) ?? ''; return stateOfRegion(v) ? v : '' } catch { return '' }
}
const offerDismissed = () => { try { return localStorage.getItem(OFFER_DISMISSED_KEY) === '1' } catch { return false } }

/**
 * One form that grows: email and Continue; then, in the same form so password managers fill both,
 * the password (or a new one, with the county the visitor was just looking at). A passkey skips
 * all of it: one button, or straight from the email field's suggestions. After a password sign-in
 * on a device that can, one offer to use Face ID next time.
 */
const Login = () => {
  const { data: user } = useSessionQuery()
  const setSession = useSetSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // undefined until the email has been looked up; then true (log in) or false (create account)
  const [userExists, setUserExists] = useState<boolean | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  // After a password sign-in: offer a passkey once, before going on.
  const [offer, setOffer] = useState<User | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const supported = useMemo(() => passkeysSupported(), [])

  // The county from the splash page comes along to a new account; it can be changed here.
  const [county, setCounty] = useState(readLandingCounty)
  const [changingCounty, setChangingCounty] = useState(false)
  const countyState = (county && stateOfRegion(county)) || ''
  const [pickedLabel, setPickedLabel] = useState<string | null>(null)
  const regions = useRegionsQuery(countyState)
  const countyName = regions.data?.find(r => r.code === county)?.name
  const stateName = fullStateName(countyState)

  // Already logged in (and not mid-offer)? Nothing to do here.
  useEffect(() => { if (user && !offer) navigate('/', { replace: true }) }, [user, offer, navigate])

  // A passkey on this device appears among the email field's suggestions; picking it signs in.
  // Started once per visit to this page (the handlers are read through refs, so re-renders don't restart it).
  const onPasskey = useRef<(signedIn: User) => void>(() => {})
  useEffect(() => { onPasskey.current = (signedIn) => { setSession(signedIn); navigate('/') } })
  useEffect(() => {
    if (!supported) return
    let live = true
    // In the background: if it can't be had (offline, an old browser), the page simply works as before.
    signInWithPasskey(true).then((signedIn) => { if (live && signedIn) onPasskey.current(signedIn) }).catch(() => {})
    return () => { live = false; cancelPasskeyAutofill() }
  }, [supported])

  const finish = (signedIn: User) => {
    // A device that could use a passkey, an account without one, and no earlier "not now": ask once.
    if (supported && !signedIn.hasPasskey && !offerDismissed()) { setOffer(signedIn); setSession(signedIn); return }
    setSession(signedIn)
    navigate('/')
  }

  const passkeyButton = async () => {
    setError(null)
    cancelPasskeyAutofill()
    try { const signedIn = await signInWithPasskey(false); if (signedIn) { setSession(signedIn); navigate('/') } } catch (err) { if (!wasCancelled(err)) setError(errorMessage(err)) }
  }

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setUserExists(undefined)
    setError(null)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    setError(null)
    if (userExists === undefined) {
      setIsBusy(true)
      try {
        const { userExists: exists } = await getUserExists(address)
        setUserExists(exists)
        // A password manager may have filled the password already: then this tap signs in.
        if (exists && password) { await signIn(address, true); return }
        window.setTimeout(() => passwordRef.current?.focus(), 0)
      } catch (err) { setError(errorMessage(err)) } finally { setIsBusy(false) }
      return
    }
    await signIn(address, userExists)
  }

  const signIn = async (address: string, exists: boolean) => {
    if (!exists && password.length < PASSWORD_MIN_LENGTH) { setError(t('login.tooShort', { count: PASSWORD_MIN_LENGTH })); return }
    setIsBusy(true)
    try {
      const place = !exists && county ? { state: countyState, location: county } : null
      finish(exists ? await login(address, password) : await signup(address, password, place))
    } catch (err) { setError(errorMessage(err)) } finally { setIsBusy(false) }
  }

  const handleForgotPassword = () => {
    toast.promise(requestPasswordReset(email.trim()), {
      pending: { render: t('login.sendingReset'), position: 'bottom-center' },
      success: { render: t('login.resetSent'), position: 'bottom-center' },
      error: { render: ({ data }) => errorMessage(data), position: 'bottom-center' }
    })
  }

  if (offer) {
    const name = unlockName()
    const turnOn = async () => {
      setError(null)
      try { await addPasskey(); toast.success(t('login.offerDone', { name }), { position: 'bottom-center' }); navigate('/') } catch (err) { if (!wasCancelled(err)) setError(errorMessage(err)) }
    }
    return (
      <main className='login'>
        <section className='login-panel'>
          <p className='login-kicker'>{t('login.oneMore')}</p>
          <h1 className='fredericka login-title'>{t('login.offerTitle', { name })}</h1>
          <p className='login-lede'>{t('login.offerLede', { device: name === 'Face ID' || name === 'Touch ID' ? name : t('login.device') })}</p>
          <button type='button' className='pill-button pill-button--primary login-submit' onClick={() => { void turnOn() }}>{t('login.use', { name })}</button>
          <button type='button' className='login-link' onClick={() => { try { localStorage.setItem(OFFER_DISMISSED_KEY, '1') } catch { /* asked again next time */ } navigate('/') }}>{t('pushAsk.notNow')}</button>
          {error && <p className='login-error' role='alert'>{error}</p>}
        </section>
      </main>
    )
  }

  const step = userExists === undefined ? 'email' : userExists ? 'login' : 'signup'

  return (
    <main className='login'>
      <section className='login-panel'>
        <h1 className='fredericka login-title'>{step === 'signup' ? t('login.createTitle') : step === 'login' ? t('login.welcomeBack') : t('login.title')}</h1>
        <p className='login-lede'>{step === 'signup' ? t('login.signupLede') : t('login.lede')}</p>

        {supported && step === 'email' && (
          <>
            <button type='button' className='pill-button login-passkey' onClick={() => { void passkeyButton() }}>
              <span aria-hidden='true'>🔑</span> {isDeviceLock(unlockName()) ? t('login.passkey') : t('login.passkeyOr', { name: unlockName() })}
            </button>
            <p className='login-or'><span>{t('login.orEmail')}</span></p>
          </>
        )}

        <form className='login-form' onSubmit={(e) => { void submit(e) }} noValidate>
          <label className='login-label' htmlFor='loginEmail'>{t('account.email')}</label>
          <input id='loginEmail' className='input email' type='email' name='email' inputMode='email' autoComplete='username webauthn' autoCapitalize='none' spellCheck={false}
            value={email} onChange={handleEmailChange} autoFocus placeholder={t('login.emailPlaceholder')} />

          {/* Always in the form, so a password manager can fill both at once; shown once it's needed. */}
          <div className={`login-password ${step === 'email' ? 'is-pending' : ''}`} aria-hidden={step === 'email'}>
            <label className='login-label' htmlFor='loginPassword'>{step === 'signup' ? t('login.createPassword', { count: PASSWORD_MIN_LENGTH }) : t('login.password')}</label>
            <div className='login-password__field'>
              <input id='loginPassword' ref={passwordRef} className='input password' type={showPassword ? 'text' : 'password'} name='password'
                autoComplete={step === 'signup' ? 'new-password' : 'current-password'} tabIndex={step === 'email' ? -1 : 0}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              {step !== 'email' && (
                <button type='button' className='login-eye' aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? t('alerts.hide') : t('alerts.show')}
                </button>
              )}
            </div>
          </div>

          {step === 'signup' && county && !changingCounty && (
            <p className='login-county'><Trans i18nKey='login.yourCounty' values={{ word: countyWord(countyState), place: pickedLabel ?? [countyName ? fullCountyName(countyName, countyState) : county, stateName].filter(Boolean).join(', ') }} components={{ b: <strong /> }} /> <button type='button' className='login-link' onClick={() => setChangingCounty(true)}>{t('login.change')}</button></p>
          )}
          {step === 'signup' && changingCounty && (
            <div className='login-county-pick'>
              <AreaPicker current={county ? { state: countyState, location: county } : null}
                onPick={(area) => { setCounty(area.location); setPickedLabel(area.label); setChangingCounty(false) }} />
              <button type='button' className='login-link' onClick={() => { setCounty(''); setPickedLabel(null); setChangingCounty(false) }}>{t('login.chooseLater')}</button>
            </div>
          )}

          <button type='submit' className='pill-button pill-button--primary login-submit' disabled={isBusy || !email.trim()}>
            {isBusy ? t('login.busy') : step === 'email' ? t('common.continue') : step === 'login' ? t('nav.login') : t('login.create')}
          </button>
          {error && <p className='login-error' role='alert'>{error}</p>}

          {step === 'login' && (
            <div className='login-forgot'>
              <span>{t('login.forgot')}</span>
              <button type='button' className='pill-button login-forgot__button' onClick={handleForgotPassword}>{t('login.emailReset')}</button>
            </div>
          )}
          {step !== 'email' && <button type='button' className='login-link' onClick={() => { setUserExists(undefined); setPassword('') }}>{t('login.differentEmail')}</button>}
        </form>
        {step === 'email' && <p className='login-fine'><Trans i18nKey='login.fine' components={{ about: <Link to='/' /> }} /></p>}
      </section>
    </main>
  )
}

export default Login
