import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clockTime, formatLocale, t } from '../../i18n'
import { useOnline } from '../../offline'
import type { GroupEvent } from '../../types'
import type { DayRoute } from './daySchedule'
import { checkReady, getReady, type ReadyPart, type ReadyStatus } from './offlineReady'
import { mapArea, mapDownloaded, setMapDownloaded } from './offlineMaps'
import OfflineMapButton from './OfflineMapButton'

const savedAt = (at: number) => {
  const date = new Date(at)
  return date.toDateString() === new Date().toDateString() ? clockTime(date) : date.toLocaleString(formatLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * "Get ready for offline", on the event page in the days before and on the day: one button that
 * fetches what the day needs while there's signal, then a line saying it's all on the phone (or
 * what isn't), and a button that opens the maps app on the day's area to download it there.
 */
const GetReady = ({ event, areaName, route = null, compact = false }: { event: GroupEvent; areaName: string; route?: DayRoute | null; compact?: boolean }) => {
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
  // The day's area for the maps app: the route and the meeting point, else the event's centre.
  const area = useMemo(
    () => mapArea({ start: route?.start, stops: route?.stops ?? [], home: { lat: event.home_lat, lng: event.home_lng }, rangeMi: event.range_mi }),
    [route, event.home_lat, event.home_lng, event.range_mi]
  )
  // "I've downloaded the map": this person's word for it, on this device, for this event.
  const [mapSaved, setMapSaved] = useState(() => mapDownloaded(event.id))
  const tickMap = (done: boolean) => { setMapSaved(done); setMapDownloaded(event.id, done) }

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
          {mapSaved && <span data-testid='ready-map'> · {t('getReady.mapDownloaded')}</span>}
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
      <OfflineMapButton area={area} areaName={areaName} downloaded={mapSaved} onDownloaded={tickMap} />
    </div>
  )
}

export default GetReady
