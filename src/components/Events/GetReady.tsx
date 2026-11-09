import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clockTime, formatLocale, t } from '../../i18n'
import { useOnline } from '../../offline'
import type { GroupEvent } from '../../types'
import type { DayRoute } from './daySchedule'
import { checkReady, getReady, isReady, lineDone, READY_FOR, READY_LINES, savedState, type ReadyStatus, type ReadyStep } from './offlineReady'
import { mapArea, mapDownloaded, setMapDownloaded } from './offlineMaps'
import OfflineMapButton from './OfflineMapButton'

const DAY_MS = 24 * 60 * 60 * 1000
const READY_DAYS_KEPT = Math.round(READY_FOR / DAY_MS)
/** When a save runs out: "Mon, Nov 16". */
const until = (at: number) => new Date(at + READY_FOR).toLocaleDateString(formatLocale(), { weekday: 'short', month: 'short', day: 'numeric' })

const savedAt = (at: number) => {
  const date = new Date(at)
  return date.toDateString() === new Date().toDateString() ? clockTime(date) : date.toLocaleString(formatLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

type Mark = { done: boolean; text: string; reason?: string; testId: string }

/** One checklist line: ✓ when it's on the phone, ☐ and a short reason when it isn't. */
const Line = ({ done, text, reason, testId }: Mark) => (
  <li className={`get-ready__line ${done ? 'is-done' : ''}`} data-testid={testId} data-done={done ? 'true' : 'false'}>
    <span className='get-ready__mark' aria-hidden='true'>{done ? '✓' : '☐'}</span>
    <span>
      {text}
      <span className='visually-hidden'> · {done ? t('getReady.done') : t('getReady.notDone')}</span>
      {!done && reason && <span className='get-ready__reason'> · {reason}</span>}
    </span>
  </li>
)

/**
 * "Get ready for offline", on the event page in the week before and on the day: a checklist of what
 * the day needs on this phone (the event, the tally's bird search, the target photos, the app
 * itself), one button that saves it while there's signal and says which step it's on, when it was
 * saved and how long that lasts, and the maps app's own offline map, which only the person can tick.
 */
const GetReady = ({ event, areaName, route = null, compact = false }: { event: GroupEvent; areaName: string; route?: DayRoute | null; compact?: boolean }) => {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [status, setStatus] = useState<ReadyStatus | null>(null)
  const [step, setStep] = useState<ReadyStep | null>(null)
  const [tried, setTried] = useState(false)
  // What's saved now, read from the phone's own caches; checked again when the tally moves.
  const tallySize = event.tally.length
  useEffect(() => {
    let live = true
    void checkReady(queryClient, event).then(s => { if (live) setStatus(s) })
    return () => { live = false }
  }, [queryClient, event.id, tallySize]) // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    setStep({ step: 1, total: READY_LINES.length, line: 'event' })
    try { setStatus(await getReady(queryClient, event, setStep)) } finally { setStep(null); setTried(true) }
  }
  const busy = step !== null
  const saved = savedState(status?.at ?? null)
  const ready = Boolean(status && isReady(status) && saved === 'fresh')
  // Why a line isn't ticked: no signal, or saved but it didn't come (try again), or not saved yet.
  const why = online ? (tried || status?.at ? t('getReady.why.failed') : t('getReady.why.notYet')) : t('getReady.why.signal')
  const lines: Mark[] = status
    ? READY_LINES.map(line => {
        const done = lineDone(status, line)
        const text = line === 'tally'
          ? (status.species ? t('getReady.line.tallyCount', { count: status.species }) : t('getReady.line.tally'))
          : line === 'photos'
            ? (status.photos.total ? t('getReady.line.photosCount', { saved: status.photos.saved, total: status.photos.total }) : t('getReady.line.photos'))
            : t(`getReady.line.${line}`)
        const reason = line === 'app' ? (status.app === 'unsupported' ? t('getReady.why.appUnsupported') : t('getReady.why.appSaving')) : why
        return { done, text, reason, testId: `ready-line-${line}` }
      })
    : []
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
        <ul className='get-ready__list' data-testid='ready-list'>
          {lines.map(line => <Line key={line.testId} {...line} />)}
          <Line
            testId='ready-line-map' done={mapSaved}
            text={mapSaved ? t('getReady.line.mapTicked') : t('getReady.line.map')}
          />
        </ul>
      )}
      {status && (
        <p className='get-ready__status' role='status' data-testid='ready-status'>
          {step
            ? t('getReady.step', { step: step.step, total: step.total, part: t(`getReady.stepName.${step.line}`) })
            : saved === 'never'
              ? (tried ? t('getReady.partial') : t('getReady.notYet'))
              : saved === 'old'
                ? t('getReady.savedOld', { time: savedAt(status.at!), days: READY_DAYS_KEPT })
                : t('getReady.savedFor', { time: savedAt(status.at!), days: READY_DAYS_KEPT, until: until(status.at!) })}
        </p>
      )}
      <p className='place__actions'>
        <button type='button' className={`pill-button ${ready ? 'pill-button--small' : 'pill-button--primary'}`} disabled={busy || !online} onClick={() => void run()} data-testid='get-ready-button'>
          {busy ? t('getReady.working') : status?.at ? t('getReady.update') : t('getReady.button')}
        </button>
        {!online && <span className='notification__hint'>{t('getReady.needsSignal')}</span>}
      </p>
      <p className='notification__hint' data-testid='ready-map-note'>{t('getReady.mapNote')}</p>
      <OfflineMapButton area={area} areaName={areaName} downloaded={mapSaved} onDownloaded={tickMap} />
    </div>
  )
}

export default GetReady
