import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clockTime, formatLocale, t } from '../../i18n'
import { useOnline } from '../../offline'
import type { GroupEvent } from '../../types'
import { checkReady, getReady, type ReadyPart, type ReadyStatus } from './offlineReady'

const GOOGLE_OFFLINE_HELP = 'https://support.google.com/maps/answer/6291838'
const APPLE_OFFLINE_HELP = 'https://support.apple.com/en-us/105084'

const savedAt = (at: number) => {
  const date = new Date(at)
  return date.toDateString() === new Date().toDateString() ? clockTime(date) : date.toLocaleString(formatLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * "Get ready for offline", on the event page in the days before and on the day: one button that
 * fetches what the day needs while there's signal, then a line saying it's all on the phone (or
 * what isn't), and a reminder to download the area in a maps app.
 */
const GetReady = ({ event, areaName, compact = false }: { event: GroupEvent; areaName: string; compact?: boolean }) => {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [status, setStatus] = useState<ReadyStatus | null>(null)
  const [busy, setBusy] = useState(false)
  // What's saved now, read from the phone's own caches; checked again when the tally moves.
  const tallySize = event.tally.length
  useEffect(() => {
    let live = true
    void checkReady(queryClient, event).then(s => { if (live) setStatus(s) })
    return () => { live = false }
  }, [queryClient, event.id, tallySize]) // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    setBusy(true)
    try { setStatus(await getReady(queryClient, event)) } finally { setBusy(false) }
  }
  const dataMissing = status?.missing.filter(part => part !== 'app') ?? []
  const ready = Boolean(status && status.at && dataMissing.length === 0)
  const partName = (part: ReadyPart) => t(`getReady.part.${part}`)

  return (
    <div className={`event-page__section get-ready ${ready ? 'is-ready' : ''}`} data-testid='get-ready'>
      {!compact && <h2 className='place__heading'>{t('getReady.heading')}</h2>}
      {status && (
        <p className='get-ready__status' role='status' data-testid='ready-status'>
          {ready
            ? t('getReady.ready', { birds: status.birds, stops: status.stops, count: status.stops, time: savedAt(status.at!) })
            : status.at
              ? t('getReady.missing', { parts: dataMissing.map(partName).join(', ') })
              : t('getReady.notYet')}
        </p>
      )}
      {status && (
        <p className='notification__hint' data-testid='ready-app'>
          {status.app === 'saved' ? t('getReady.appSaved') : status.app === 'saving' ? t('getReady.appSaving') : t('getReady.appUnsupported')}
          {status.photos.total > 0 && status.app !== 'unsupported' && <> · {t('getReady.photos', { saved: status.photos.saved, count: status.photos.total })}</>}
        </p>
      )}
      <p className='place__actions'>
        <button type='button' className={`pill-button ${ready ? 'pill-button--small' : 'pill-button--primary'}`} disabled={busy || !online} onClick={() => void run()} data-testid='get-ready-button'>
          {busy ? t('getReady.working') : ready ? t('getReady.again') : t('getReady.button')}
        </button>
        {!online && <span className='notification__hint'>{t('getReady.needsSignal')}</span>}
      </p>
      <p className='notification__hint get-ready__maps'>
        {t('getReady.maps', { area: areaName })}{' '}
        <a href={GOOGLE_OFFLINE_HELP} target='_blank' rel='noreferrer'>{t('getReady.mapsGoogle')}</a>
        {' · '}
        <a href={APPLE_OFFLINE_HELP} target='_blank' rel='noreferrer'>{t('getReady.mapsApple')}</a>
      </p>
    </div>
  )
}

export default GetReady
