import { useMutationState } from '@tanstack/react-query'
import { ClockIcon } from '../Icons/Icons'
import { clockTime, formatLocale, t } from '../../i18n'
import { isNetworkError, useOnline } from '../../offline'
import { TALLY_KEY } from '../../tallySync'
import './Offline.css'

const savedTime = (at: number) => {
  const date = new Date(at)
  if (date.toDateString() === new Date().toDateString()) return clockTime(date)
  return date.toLocaleString(formatLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * Over a page built from saved data, while there's no signal (or the last try didn't get through):
 * "Offline · showing what was saved at 6:42 AM". Nothing when the data is fresh from the server.
 */
export const OfflineNote = ({ updatedAt, error }: { updatedAt: number; error?: unknown }) => {
  const online = useOnline()
  if (!updatedAt || (online && !isNetworkError(error))) return null
  return (
    <p className='offline-note' role='status' data-testid='offline-note'>
      <ClockIcon />
      <span>{t('offline.savedAt', { time: savedTime(updatedAt) })}</span>
    </p>
  )
}

/** "3 waiting to sync": tally changes made here that haven't reached the server yet. Gone once they're sent. */
export const SyncBadge = () => {
  const waiting = useMutationState({ filters: { mutationKey: TALLY_KEY, status: 'pending' }, select: (m) => m.mutationId }).length
  if (!waiting) return null
  return (
    <p className='sync-badge' role='status' data-testid='sync-badge'>
      <ClockIcon />
      <span>{t('offline.waiting', { count: waiting })}</span>
    </p>
  )
}

/** A page that needs an account, opened with no signal on a device that has never been signed in. */
export const OfflineSignIn = ({ retry }: { retry: () => void }) => (
  <section className='event-page' role='alert'>
    <p className='event-page__missing'>{t('offline.signInUnknown')}</p>
    <button type='button' className='pill-button pill-button--small' onClick={retry}>{t('offline.tryAgain')}</button>
  </section>
)

/** In place of a page that couldn't load: no signal and nothing saved, or really not there (`missing`). */
export const LoadProblem = ({ error, missing }: { error: unknown; missing: string }) => (
  <p className='event-page__missing' role='alert'>{isNetworkError(error) ? t('offline.noSignalNothingSaved') : missing}</p>
)
