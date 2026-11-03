import RouteEditor, { type Leg } from '../RouteEditor/RouteEditor'
import { type Suggestion } from '../PlaceSearch/PlaceSearch'
import { longDistance, useDistanceUnit } from '../../distance'
import type { PlanPoint } from '../../routePlan'
import type { GoPlace } from '../../types'
import { number, t } from '../../i18n'

interface RouteCardProps {
  state: string
  places: GoPlace[]
  speciesCount: number
  /** Counting lifers (birds not on the life list) rather than the watch list. */
  lifers?: boolean
  stops: PlanPoint[]
  start: PlanPoint | null
  /** A place being considered, shown as a ghost last stop. */
  preview?: PlanPoint | null
  /** The drive into each stop (from the one before, or from the start); null where not known yet. */
  arriving: Leg[]
  drive: { minutes: number; miles: number } | null
  covers: number
  url: string | null
  custom: boolean
  /** The last save to the account failed; the route is still kept in this browser. */
  saveFailed?: boolean
  editing: boolean
  showRoute: boolean
  onEditing: (editing: boolean) => void
  onStops: (stops: PlanPoint[]) => void
  onStart: (start: PlanPoint | null) => void
  onReset: () => void
  onStopClick: (stop: PlanPoint) => void
  onToggleRoute: () => void
  /** Make a read-only link to this route (the start is never included). */
  onShare?: () => void
}

const birdsWord = (n: number) => t('route.birds', { count: n, n: number(n, { maximumFractionDigits: 1 }) })
const expectedText = (place: GoPlace) => place.bestTime ? t('route.expectedBest', { birds: birdsWord(place.expected), best: place.bestTime }) : t('route.expected', { birds: birdsWord(place.expected) })

/**
 * The morning route: suggested from the watch list, or the person's own. Editing (the shared
 * RouteEditor) adds stops from the list or from any hotspot or address by name, removes them,
 * reorders them (drag the handle, or the arrows), and sets where the day starts.
 */
const RouteCard = (props: RouteCardProps) => {
  const { state, places, speciesCount, lifers = false, stops, start, preview = null, arriving, drive, covers, url, custom, saveFailed = false, editing, showRoute } = props
  const { onEditing, onStops, onStart, onReset, onStopClick, onToggleRoute, onShare } = props
  const unit = useDistanceUnit()
  const byId = new Map(places.map(p => [p.locId, p]))
  const suggestions: Suggestion[] = places
    .filter(p => p.isHotspot !== false && p.lat !== null && p.lng !== null)
    .map(p => ({ point: { locId: p.locId, name: p.locName ?? p.locId, lat: p.lat!, lng: p.lng! }, detail: expectedText(p) }))
  const describe = (stop: PlanPoint) => {
    const place = stop.locId ? byId.get(stop.locId) : undefined
    return (
      <>
        {place
          ? <span>{expectedText(place)}</span>
          : <span>{stop.note || t('route.addedByYou')}</span>}
        {place && place.birds.length > 0 && !editing && <span className='go__stop-birds'>{place.birds.slice(0, 4).map(b => `${b.comName} ${b.chance}%`).join(' · ')}{place.birds.length > 4 ? ` · +${place.birds.length - 4}` : ''}</span>}
      </>
    )
  }

  const unscored = stops.some(s => !s.locId || !byId.has(s.locId))
  const firstBest = stops[0]?.locId ? byId.get(stops[0].locId)?.bestTime ?? null : null

  return (
    <div className={`go__route ${editing ? 'is-editing' : ''}`}>
      <h2 className='fredericka go__route-head'>{custom ? t('route.yours') : t('route.suggested')}</h2>
      <RouteEditor state={state} stops={stops} start={start} arriving={arriving} editing={editing} describe={describe}
        suggestions={suggestions} suggestionsLabel={t('route.goodPlaces')} preview={preview} custom={custom}
        onStops={onStops} onStart={onStart} onReset={onReset} onDone={() => onEditing(false)} onStopClick={onStopClick}
        between={(
          <>
            {stops.length > 0 && (
              <p className='go__covers'>
                {[
                  lifers ? t('route.coversLifers', { covers: number(covers, { maximumFractionDigits: 1 }), count: speciesCount }) : t('route.coversBirds', { birds: birdsWord(covers), count: speciesCount }),
                  drive ? t('route.driving', { minutes: drive.minutes, distance: longDistance(drive.miles, unit) }) : null,
                  firstBest ? t('route.startAt', { name: stops[0].name, best: firstBest }) : null,
                  unscored ? t('route.unscored') : null
                ].filter(Boolean).join(' ')}
              </p>
            )}
            {saveFailed && <p className='go__hint'>{t('route.saveFailed')}</p>}
          </>
        )} />
      {!editing && (
        <div className='go__route-actions'>
          {stops.length > 0 && <button type='button' className={`pill-button ${showRoute ? 'pill-button--primary' : ''}`} aria-pressed={showRoute} onClick={onToggleRoute}>{showRoute ? t('route.hide') : t('route.show')}</button>}
          {url && <a className='pill-button' href={url} target='_blank' rel='noreferrer'>{t('route.openMaps')}</a>}
          <button type='button' className='pill-button' onClick={() => onEditing(true)}>{t('route.edit')}</button>
          {onShare && stops.length > 0 && <button type='button' className='pill-button' onClick={onShare}>{t('route.share')}</button>}
        </div>
      )}
    </div>
  )
}

export default RouteCard
