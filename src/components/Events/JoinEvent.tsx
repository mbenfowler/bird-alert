import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useEventPreviewQuery, useSessionQuery } from '../../hooks/queries'
import { useJoinEventMutation } from '../../hooks/mutations'
import { dateRange, t } from '../../i18n'
import { forgetJoin, rememberJoin } from './pendingJoin'
import { forgetNext, useLoginHere } from '../../returnTo'
import '../AlertCenter/Places.css'
import './Events.css'

/**
 * Where an invite link lands (/events/join/:token): what the event is, then Join. Someone not signed in
 * logs in or signs up first and is brought back here (pendingJoin).
 */
const JoinEvent = () => {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const session = useSessionQuery()
  const user = session.isError ? null : session.data
  const preview = useEventPreviewQuery(token)
  const join = useJoinEventMutation()
  const loginHere = useLoginHere()
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  // Logged out: remember the invite for after signing in. Signed in and here: nothing to remember.
  useEffect(() => {
    if (user === null) rememberJoin(token)
    else if (user) forgetJoin()
  }, [user, token])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setProblem(t('events.pickName'))
    setProblem(null)
    join.mutate({ token, displayName: name.trim() }, {
      onSuccess: (joined) => { forgetJoin(); forgetNext(); toast.success(t('events.joined'), { position: 'bottom-center' }); navigate(`/events/${encodeURIComponent(String(joined.id))}`) },
      onError: (error) => setProblem(errorMessage(error))
    })
  }

  if (preview.isPending || user === undefined) return <LoadingState />
  if (preview.isError || !preview.data) {
    return <section className='event-page'><p className='event-page__missing'>{t('events.joinMissing')}</p></section>
  }
  const p = preview.data
  const members = typeof p.members === 'number' ? p.members : Array.isArray(p.members) ? p.members.length : null
  return (
    <section className='event-page'>
      <h1 className='fredericka event-page__title'>{t('events.joinHeading', { name: p.name })}</h1>
      <p className='event-page__what'>
        {p.kind === 'bigday' && <span className='place__badge'>{t('events.bigDay')}</span>}
        {' '}{dateRange(p.starts_on, p.ends_on)}{p.area ? ` · ${p.area}` : ''}
      </p>
      {members !== null && <p className='notification__hint'>{t('events.joinMembers', { count: members })}</p>}
      {user
        ? <form className='event-page__join' onSubmit={submit} noValidate>
            <label>
              <span className='place-form__label'>{t('events.yourName')}</span>
              <input type='text' name='display_name' value={name} maxLength={30} autoComplete='given-name' placeholder={t('events.yourNamePlaceholder')} onChange={(e) => setName(e.target.value)} />
            </label>
            {problem && <p className='place-form__error' role='alert'>{problem}</p>}
            <button type='submit' className='pill-button pill-button--primary' disabled={join.isPending}>{join.isPending ? t('events.joining') : t('events.join')}</button>
          </form>
        : <div className='event-page__join'>
            <p>{t('events.joinSignIn')}</p>
            <Link className='pill-button pill-button--primary' to={loginHere}>{t('events.joinSignInButton')}</Link>
          </div>}
    </section>
  )
}

export default JoinEvent
