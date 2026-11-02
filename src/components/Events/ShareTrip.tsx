import { useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useShareTripMutation } from '../../hooks/mutations'
import { t } from '../../i18n'
import type { Id } from '../../types'

/**
 * "Share with my group": turns a trip into a group event (the trip moves to Group events), asking
 * only for the name the group knows the person by. Left empty on purpose: an email address is not
 * a name to show friends.
 */
const ShareTrip = ({ tripId, dates }: { tripId: Id; dates: string }) => {
  const share = useShareTripMutation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setProblem(t('events.pickName'))
    setProblem(null)
    share.mutate({ tripId, displayName: name.trim() }, {
      onSuccess: () => { toast.success(t('events.shared'), { position: 'bottom-center' }); setOpen(false) },
      onError: (error) => setProblem(errorMessage(error))
    })
  }
  if (!open) {
    return <button type='button' className='link-button link-text' aria-label={t('events.shareTripLabel', { dates })} onClick={() => setOpen(true)}>{t('events.shareTrip')}</button>
  }
  return (
    <form className='event-share' onSubmit={submit} noValidate>
      <label>
        <span className='place-form__label'>{t('events.yourName')}</span>
        <input type='text' name='display_name' value={name} maxLength={30} autoComplete='given-name' placeholder={t('events.yourNamePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </label>
      {problem && <p className='place-form__error' role='alert'>{problem}</p>}
      <div className='place-form__actions'>
        <button type='submit' className='pill-button pill-button--primary pill-button--small' disabled={share.isPending}>{share.isPending ? t('events.creating') : t('events.create')}</button>
        <button type='button' className='link-button link-text' onClick={() => { setOpen(false); setProblem(null) }}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

export default ShareTrip
