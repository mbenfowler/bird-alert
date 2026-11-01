import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { deletePasskey, errorMessage, getPasskeys } from '../../apiCalls'
import { addPasskey, isDeviceLock, passkeysSupported, unlockName, wasCancelled } from '../../passkeys'
import type { Passkey } from '../../types'
import '../LifeList/LifeList.css'
import './PasskeySettings.css'
import { monthDayYear, t } from '../../i18n'

const day = (iso: string) => monthDayYear(new Date(iso))

/** Settings → Passkeys: sign in with Face ID and the like; add one on this device, remove old ones. */
const PasskeySettings = () => {
  const queryClient = useQueryClient()
  const keys = useQuery({ queryKey: ['passkeys'], queryFn: getPasskeys })
  const supported = passkeysSupported()
  const name = unlockName()
  const deviceLock = isDeviceLock(name)
  const here = window.location.hostname
  const set = (list: Passkey[]) => { queryClient.setQueryData(['passkeys'], list); void queryClient.invalidateQueries({ queryKey: ['session'] }) }
  const add = useMutation({
    mutationFn: addPasskey,
    onSuccess: (list) => { set(list); toast.success(t('passkeys.added', { name }), { position: 'bottom-center' }) },
    onError: (error) => { if (!wasCancelled(error)) toast.error(errorMessage(error), { position: 'bottom-center' }) }
  })
  const remove = useMutation({ mutationFn: deletePasskey, onSuccess: set, onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
  const list = keys.data ?? []

  return (
    <section className='life-list passkeys'>
      <h2 className='fredericka'>{t('passkeys.title')}</h2>
      <div className='notification life-list__card'>
        <div className='notification__text'>
          <p className='passkeys__count'>{list.length ? t('passkeys.count', { count: list.length }) : t('passkeys.none')}</p>
          <p className='notification__hint'>{t('passkeys.hint', { name: deviceLock ? t('passkeys.yourDevice') : name })}</p>
        </div>
        {supported && <button type='button' className='pill-button life-list__view' onClick={() => add.mutate()} disabled={add.isPending}>{add.isPending ? t('passkeys.adding') : t('passkeys.add')}</button>}
      </div>
      {list.length > 0 && (
        <ul className='passkeys__list'>
          {list.map(k => (
            <li key={k.id}>
              <span>
                <strong>{k.name ?? t('passkeys.passkey')}</strong>
                <span className='passkeys__meta'>{[t('passkeys.addedOn', { day: day(k.createdAt) }), k.lastUsedAt ? t('passkeys.lastUsed', { day: day(k.lastUsedAt) }) : null, k.site !== here ? t('passkeys.forSite', { site: k.site }) : null].filter(Boolean).join(' · ')}</span>
              </span>
              <button type='button' className='login-link passkeys__remove' onClick={() => remove.mutate(k.id)} disabled={remove.isPending}>{t('passkeys.remove')}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PasskeySettings
