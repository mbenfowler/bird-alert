import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useDeleteAccountMutation } from '../../hooks/mutations'
import { soundDangerZone } from '../../alertMode'
import { unlockAudio } from '../../alertSounds'
import './DeleteAccount.css'
import { t } from '../../i18n'

/**
 * At the foot of settings, out of the way: a quiet link that opens a plain explanation and the
 * one button that deletes the account. Nothing goes until that second tap. Opening it sounds the
 * app's red alert, so it's plain this is the danger zone.
 */
const DeleteAccount = () => {
  const [asking, setAsking] = useState(false)
  const remove = useDeleteAccountMutation()
  const navigate = useNavigate()

  if (!asking) return <button type='button' className='delete-account__ask' onClick={() => { unlockAudio(); soundDangerZone(); setAsking(true) }}>{t('deleteAccount.ask')}</button>

  const confirm = () => remove.mutate(undefined, {
    onSuccess: () => { toast.success(t('deleteAccount.deleted'), { position: 'bottom-center' }); navigate('/login', { replace: true }) }
  })
  return (
    <div className='delete-account' role='group' aria-labelledby='delete-account-title'>
      <h2 id='delete-account-title' className='delete-account__title'>{t('deleteAccount.title')}</h2>
      <p>{t('deleteAccount.explain')}</p>
      {remove.isError && <p className='delete-account__error' role='alert'>{errorMessage(remove.error)}</p>}
      <div className='delete-account__actions'>
        <button type='button' className='pill-button pill-button--primary' onClick={confirm} disabled={remove.isPending}>{remove.isPending ? t('deleteAccount.deleting') : t('deleteAccount.ask')}</button>
        <button type='button' className='pill-button' onClick={() => setAsking(false)} disabled={remove.isPending}>{t('deleteAccount.keep')}</button>
      </div>
    </div>
  )
}

export default DeleteAccount
