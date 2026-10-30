import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useDeleteAccountMutation } from '../../hooks/mutations'
import { soundDangerZone } from '../../alertMode'
import { unlockAudio } from '../../alertSounds'
import './DeleteAccount.css'

/**
 * At the foot of settings, out of the way: a quiet link that opens a plain explanation and the
 * one button that deletes the account. Nothing goes until that second tap. Opening it sounds the
 * app's red alert, so it's plain this is the danger zone.
 */
const DeleteAccount = () => {
  const [asking, setAsking] = useState(false)
  const remove = useDeleteAccountMutation()
  const navigate = useNavigate()

  if (!asking) return <button type='button' className='delete-account__ask' onClick={() => { unlockAudio(); soundDangerZone(); setAsking(true) }}>Delete my account</button>

  const confirm = () => remove.mutate(undefined, {
    onSuccess: () => { toast.success('Your account has been deleted.', { position: 'bottom-center' }); navigate('/login', { replace: true }) }
  })
  return (
    <div className='delete-account' role='group' aria-labelledby='delete-account-title'>
      <h2 id='delete-account-title' className='delete-account__title'>Delete your account?</h2>
      <p>This deletes your account, your watch list, your life list, your saved routes and your alerts, for good. It can’t be undone. Links you shared stay up, without your name.</p>
      {remove.isError && <p className='delete-account__error' role='alert'>{errorMessage(remove.error)}</p>}
      <div className='delete-account__actions'>
        <button type='button' className='pill-button pill-button--primary' onClick={confirm} disabled={remove.isPending}>{remove.isPending ? 'Deleting…' : 'Delete my account'}</button>
        <button type='button' className='pill-button' onClick={() => setAsking(false)} disabled={remove.isPending}>Keep it</button>
      </div>
    </div>
  )
}

export default DeleteAccount
