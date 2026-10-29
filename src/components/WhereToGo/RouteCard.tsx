import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import PlaceSearch, { type Suggestion } from '../PlaceSearch/PlaceSearch'
import { ChevronIcon, CloseIcon, DragIcon, LocateIcon } from '../Icons/Icons'
import { longDistance, shortDistance, useDistanceUnit, type DistanceUnit } from '../../distance'
import { MAX_ROUTE_STOPS, move, roadKm, samePlace, shortestOrder, type PlanPoint } from '../../routePlan'
import type { GoPlace } from '../../types'

type Leg = { minutes: number; miles: number } | null

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

const birdsWord = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? 'bird' : 'birds'}`
const legText = (leg: Leg, unit: DistanceUnit) => leg ? `↓ ${leg.minutes} min drive · ${shortDistance(leg.miles, unit)}` : '↓ drive'

/**
 * The morning route: suggested from the watch list, or the person's own. Editing adds stops from
 * the list or from any hotspot or address by name, removes them, reorders them (drag the handle,
 * or the arrows), and sets where the day starts.
 */
const RouteCard = (props: RouteCardProps) => {
  const { state, places, speciesCount, lifers = false, stops, start, preview = null, arriving, drive, covers, url, custom, saveFailed = false, editing, showRoute } = props
  const { onEditing, onStops, onStart, onReset, onStopClick, onToggleRoute, onShare } = props
  const unit = useDistanceUnit()
  const byId = new Map(places.map(p => [p.locId, p]))
  const [settingStart, setSettingStart] = useState(false)
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')

  // Dragging by the handle: the row follows the pointer past its neighbours' midpoints. Listeners
  // sit on the window, since the row itself moves in the DOM while it is dragged.
  const listRef = useRef<HTMLOListElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const dragRef = useRef<{ index: number; stops: PlanPoint[] } | null>(null)
  const stopsRef = useRef(stops)
  useEffect(() => { stopsRef.current = stops }, [stops])
  const startDrag = (index: number) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = { index, stops: stopsRef.current }
    setDragging(index)
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      const rows = listRef.current ? [...listRef.current.querySelectorAll<HTMLElement>(':scope > .go__stop')] : []
      if (!drag || !rows.length) return
      let target = drag.index
      rows.forEach((row, j) => {
        const r = row.getBoundingClientRect()
        const mid = r.top + r.height / 2
        if (j < drag.index && ev.clientY < mid) target = Math.min(target, j)
        if (j > drag.index && ev.clientY > mid) target = Math.max(target, j)
      })
      if (target !== drag.index) {
        drag.stops = move(drag.stops, drag.index, target)
        drag.index = target
        setDragging(target)
        onStops(drag.stops)
      }
    }
    const onUp = () => {
      dragRef.current = null
      setDragging(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const full = stops.length >= MAX_ROUTE_STOPS
  const addStop = (point: PlanPoint) => { if (!full && !stops.some(s => samePlace(s, point))) onStops([...stops, point]) }
  const suggestions: Suggestion[] = places
    .filter(p => p.isHotspot !== false && p.lat !== null && p.lng !== null && !stops.some(s => s.locId === p.locId))
    .slice(0, 5)
    .map(p => ({ point: { locId: p.locId, name: p.locName ?? p.locId, lat: p.lat!, lng: p.lng! }, detail: `${birdsWord(p.expected)} expected${p.bestTime ? ` · best ${p.bestTime}` : ''}` }))

  const locate = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating('idle'); setSettingStart(false); onStart({ locId: null, name: 'My location', lat: Math.round(pos.coords.latitude * 1e4) / 1e4, lng: Math.round(pos.coords.longitude * 1e4) / 1e4 }) },
      () => setLocating('failed'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }

  const unscored = stops.some(s => !s.locId || !byId.has(s.locId))
  const firstBest = stops[0]?.locId ? byId.get(stops[0].locId)?.bestTime ?? null : null

  return (
    <div className={`go__route ${editing ? 'is-editing' : ''}`}>
      <h2 className='fredericka go__route-head'>{custom ? 'Your route' : 'A morning route'}</h2>

      {(start || editing) && (
        <div className='go__start'>
          <span className='go__start-dot' aria-hidden='true' />
          <span className='go__start-text'>
            <span className='go__start-label'>Start</span>
            <strong>{start ? start.name : 'Wherever you are when you open Maps'}</strong>
          </span>
          {editing && !settingStart && <button type='button' className='go__link-button' onClick={() => setSettingStart(true)}>{start ? 'Change' : 'Set'}</button>}
          {editing && start && !settingStart && <button type='button' className='go__icon-button' aria-label='Clear the starting point' onClick={() => onStart(null)}><CloseIcon /></button>}
        </div>
      )}
      {editing && settingStart && (
        <div className='go__start-picker'>
          <PlaceSearch state={state} label='Starting point' placeholder='Town, address or hotspot' autoFocus onPick={(p) => { onStart(p); setSettingStart(false) }} />
          <div className='go__start-actions'>
            <button type='button' className='pill-button' onClick={locate} disabled={locating === 'busy'}><LocateIcon className='go__btn-icon' />{locating === 'busy' ? 'Finding you…' : 'Use my location'}</button>
            <button type='button' className='go__link-button' onClick={() => setSettingStart(false)}>Cancel</button>
          </div>
          {locating === 'failed' && <p className='go__hint'>Couldn’t get your location. Type a town or address instead.</p>}
        </div>
      )}

      {stops.length > 0 ? (
        <ol className='go__stops' ref={listRef}>
          {stops.map((stop, i) => {
            const place = stop.locId ? byId.get(stop.locId) : undefined
            const leg = i > 0 || start ? <span className='go__leg'>{legText(arriving[i] ?? null, unit)}</span> : null
            return (
              <li key={stop.locId ?? `${stop.lat},${stop.lng}`} className={`go__stop ${dragging === i ? 'is-dragging' : ''}`}>
                {leg}
                <div className='go__stop-row'>
                  {editing && (
                    <span className='go__drag' role='presentation' title='Drag to reorder' onPointerDown={startDrag(i)}><DragIcon /></span>
                  )}
                  <button type='button' className='go__stop-main' onClick={() => onStopClick(stop)}>
                    <span className='go__stop-n'>{i + 1}</span>
                    <span className='go__stop-text'>
                      <strong>{stop.name}</strong>
                      {place
                        ? <span>{birdsWord(place.expected)} expected{place.bestTime ? ` · best ${place.bestTime}` : ''}</span>
                        : <span>{stop.note || 'Added by you'}</span>}
                      {place && place.birds.length > 0 && !editing && <span className='go__stop-birds'>{place.birds.slice(0, 4).map(b => `${b.comName} ${b.chance}%`).join(' · ')}{place.birds.length > 4 ? ` · +${place.birds.length - 4}` : ''}</span>}
                    </span>
                  </button>
                  {editing && (
                    <span className='go__stop-tools'>
                      <button type='button' className='go__icon-button' aria-label={`Move ${stop.name} up`} disabled={i === 0} onClick={() => onStops(move(stops, i, i - 1))}><ChevronIcon className='is-up' /></button>
                      <button type='button' className='go__icon-button' aria-label={`Move ${stop.name} down`} disabled={i === stops.length - 1} onClick={() => onStops(move(stops, i, i + 1))}><ChevronIcon /></button>
                      <button type='button' className='go__icon-button' aria-label={`Remove ${stop.name}`} onClick={() => onStops(stops.filter((_, j) => j !== i))}><CloseIcon /></button>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
          {preview && (
            <li className='go__stop is-preview' aria-live='polite'>
              {(stops.length > 0 || start) && <span className='go__leg'>↓ about {shortDistance(Math.round(roadKm(stops[stops.length - 1] ?? start!, preview) / 1.609344 * 10) / 10, unit)}</span>}
              <div className='go__stop-row'>
                <span className='go__stop-main'>
                  <span className='go__stop-n'>{stops.length + 1}</span>
                  <span className='go__stop-text'><strong>{preview.name}</strong><span>Preview · {preview.note || 'not on the route yet'}</span></span>
                </span>
              </div>
            </li>
          )}
        </ol>
      ) : <p className='go__hint'>No stops yet. Add one below.</p>}

      {stops.length > 0 && (
        <p className='go__covers'>
          Together these cover about {lifers ? `${covers % 1 === 0 ? covers : covers.toFixed(1)} of the ${speciesCount} possible ${speciesCount === 1 ? 'lifer' : 'lifers'}` : `${birdsWord(covers)} of your ${speciesCount}`}.
          {drive ? ` ${drive.minutes} minutes of driving, ${longDistance(drive.miles, unit)}.` : ''}
          {firstBest ? ` Start at ${stops[0].name}, best ${firstBest}.` : ''}
          {unscored ? ' Stops from outside your list’s places aren’t counted.' : ''}
        </p>
      )}

      {saveFailed && <p className='go__hint'>Couldn’t save this route to your account just now. It’s kept on this device and will save with your next change.</p>}
      {editing ? (
        <>
          <div className='go__add'>
            {full
              ? <p className='go__hint'>That’s {MAX_ROUTE_STOPS} stops, as many as Maps will take.</p>
              : <PlaceSearch state={state} label='Add a stop' placeholder='Add a stop: any hotspot or address' onPick={addStop}
                  suggestions={suggestions} suggestionsLabel='Good places from your list' />}
          </div>
          <div className='go__route-actions'>
            {stops.length > 2 && <button type='button' className='pill-button' onClick={() => onStops(shortestOrder(stops, start))}>Shortest order</button>}
            {custom && <button type='button' className='pill-button' onClick={onReset}>Back to suggested</button>}
            <button type='button' className='pill-button pill-button--primary' onClick={() => { setSettingStart(false); onEditing(false) }}>Done</button>
          </div>
        </>
      ) : (
        <div className='go__route-actions'>
          {stops.length > 0 && <button type='button' className={`pill-button ${showRoute ? 'pill-button--primary' : ''}`} aria-pressed={showRoute} onClick={onToggleRoute}>{showRoute ? 'Hide route on map' : 'Show route on map'}</button>}
          {url && <a className='pill-button' href={url} target='_blank' rel='noreferrer'>Open in Maps</a>}
          <button type='button' className='pill-button' onClick={() => onEditing(true)}>Edit route</button>
          {onShare && stops.length > 0 && <button type='button' className='pill-button' onClick={onShare}>Share</button>}
        </div>
      )}
    </div>
  )
}

export default RouteCard
