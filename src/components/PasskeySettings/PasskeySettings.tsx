import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { deletePasskey, errorMessage, getPasskeys } from '../../apiCalls'
import { addPasskey, passkeysSupported, unlockName, wasCancelled } from '../../passkeys'
import type { Passkey } from '../../types'
import '../LifeList/LifeList.css'
import './PasskeySettings.css'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** Settings → Passkeys: sign in with Face ID and the like; add one on this device, remove old ones. */
const PasskeySettings = () => {
  const queryClient = useQueryClient()
  const keys = useQuery({ queryKey: ['passkeys'], queryFn: getPasskeys })
  const supported = passkeysSupported()
  const name = unlockName()
  const here = window.location.hostname
  const set = (list: Passkey[]) => { queryClient.setQueryData(['passkeys'], list); void queryClient.invalidateQueries({ queryKey: ['session'] }) }
  const add = useMutation({
    mutationFn: addPasskey,
    onSuccess: (list) => { set(list); toast.success(`Added. Next time, sign in with ${name}.`, { position: 'bottom-center' }) },
    onError: (error) => { if (!wasCancelled(error)) toast.error(errorMessage(error), { position: 'bottom-center' }) }
  })
  const remove = useMutation({ mutationFn: deletePasskey, onSuccess: set, onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
  const list = keys.data ?? []

  return (
    <section className='life-list passkeys'>
      <h2 className='fredericka'>Passkeys</h2>
      <div className='notification life-list__card'>
        <div className='notification__text'>
          <p className='life-list__count'>{list.length ? `${list.length} ${list.length === 1 ? 'passkey' : 'passkeys'}` : 'No passkeys yet'}</p>
          <p className='notification__hint'>Sign in with {name === 'your device’s lock' ? 'your device' : name} instead of typing a password. Nothing about your face or fingerprint leaves the device.</p>
        </div>
        {supported && <button type='button' className='pill-button life-list__view' onClick={() => add.mutate()} disabled={add.isPending}>{add.isPending ? 'Adding…' : 'Add on this device'}</button>}
      </div>
      {list.length > 0 && (
        <ul className='passkeys__list'>
          {list.map(k => (
            <li key={k.id}>
              <span>
                <strong>{k.name ?? 'Passkey'}</strong>
                <span className='passkeys__meta'>Added {day(k.createdAt)}{k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : ''}{k.site !== here ? ` · for ${k.site}` : ''}</span>
              </span>
              <button type='button' className='login-link passkeys__remove' onClick={() => remove.mutate(k.id)} disabled={remove.isPending}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PasskeySettings
