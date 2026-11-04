import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import PlaceSearch, { type Suggestion } from '../PlaceSearch/PlaceSearch'
import { ChevronIcon, CloseIcon, DragIcon, LocateIcon } from '../Icons/Icons'
import { shortDistance, useDistanceUnit, type DistanceUnit } from '../../distance'
import { MAX_ROUTE_STOPS, move, roadKm, samePlace, shortestOrder, type PlanPoint } from '../../routePlan'
import { t } from '../../i18n'
import { duration } from '../../duration'
import StayStepper, { type Stay } from './StayStepper'
import '../WhereToGo/WhereToGo.css'

export type Leg = { minutes: number; miles: number } | null

export interface RouteEditorProps {
  /** For finding places by name. */
  state: string
  stops: PlanPoint[]
  start: PlanPoint | null
  /** The drive into each stop (from the one before, or from the start); null where not known yet. */
  arriving: Leg[]
  editing: boolean
  /** What a stop row says under its name: the page knows what each place is worth. */
  describe: (stop: PlanPoint, i: number) => ReactNode
  /** Places to add, shown before anything is typed. */
  suggestions: Suggestion[]
  suggestionsLabel: string
  /** A place being considered, shown as a ghost last stop. */
  preview?: PlanPoint | null
  /** Shown between the stops and the add box: the page's summary of the route. */
  between?: ReactNode
  /** The stops differ from the suggestion, so there is one to go back to. */
  custom: boolean
  onStops: (stops: PlanPoint[]) => void
  onStart: (start: PlanPoint | null) => void
  onReset: () => void
  onDone: () => void
  onStopClick?: (stop: PlanPoint, index: number) => void
  /** The stop picked out (from its pin on the map), shown highlighted. */
  activeStop?: number | null
  /**
   * Always editing, with no Done, reset or shortest-order buttons (the page has its own menu), and
   * the add box behind one "+ Add a stop" row.
   */
  inline?: boolean
  /** The reset button's words, when the page says it differently. */
  resetLabel?: string
  /** What the start is called, and what it says when there is none, when the page says it differently. */
  startLabel?: string
  startEmpty?: string
  /** Time at each stop, changed with a stepper while editing. Optional: /go has none. */
  stays?: { of: (i: number) => Stay; onChange: (i: number, minutes: number | null) => void }
  /** How a drive between stops reads, when the page says it differently. */
  legLabel?: (leg: NonNullable<Leg>) => string
  /** When the day starts at the start ('05:30', the page's own clock), set under it while editing. Optional: /go has none. */
  startTime?: { value: string | null; onChange: (time: string | null) => void; label: string }
}

const legText = (leg: Leg, unit: DistanceUnit) => leg ? t('route.leg', { minutes: leg.minutes, distance: shortDistance(leg.miles, unit) }) : t('route.legUnknown')

/**
 * A route's start and stops, and while editing the tools to change them: add from the page's
 * suggestions or any hotspot or address by name, remove, reorder (drag the handle, or the arrows),
 * the shortest order, set where the day starts, and go back to the suggestion. Shared by the
 * morning route on Where to go and an event's route.
 */
const RouteEditor = ({ state, stops, start, arriving, editing, describe, suggestions, suggestionsLabel, preview = null, between, custom, onStops, onStart, onReset, onDone, onStopClick, resetLabel, startLabel, startEmpty, stays, legLabel, startTime, activeStop = null, inline = false }: RouteEditorProps) => {
  const [adding, setAdding] = useState(false)
  const unit = useDistanceUnit()
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
  const addStop = (point: PlanPoint) => { if (!full && !stops.some(s => samePlace(s, point))) onStops([...stops, point]); setAdding(false) }
  const fresh = suggestions.filter(s => !stops.some(stop => samePlace(stop, s.point)))

  const locate = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating('idle'); setSettingStart(false); onStart({ locId: null, name: t('route.myLocation'), lat: Math.round(pos.coords.latitude * 1e4) / 1e4, lng: Math.round(pos.coords.longitude * 1e4) / 1e4 }) },
      () => setLocating('failed'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }

  return (
    <>
      {(start || editing) && (
        <div className='go__start'>
          <span className='go__start-dot' aria-hidden='true' />
          <span className='go__start-text'>
            <span className='go__start-label'>{startLabel ?? t('route.start')}</span>
            <strong>{start ? start.name : startEmpty ?? t('route.startAnywhere')}</strong>
          </span>
          {editing && !settingStart && <button type='button' className='go__link-button' onClick={() => setSettingStart(true)}>{start ? t('common.change') : t('route.set')}</button>}
          {editing && start && !settingStart && <button type='button' className='go__icon-button' aria-label={t('route.clearStart')} onClick={() => onStart(null)}><CloseIcon /></button>}
        </div>
      )}
      {editing && start && startTime && !settingStart && (
        <label className='go__start-time'>
          <span className='go__start-label'>{startTime.label}</span>
          <input type='time' value={startTime.value ?? ''} data-testid='meeting-time' onChange={(e) => startTime.onChange(e.target.value || null)} />
        </label>
      )}
      {editing && settingStart && (
        <div className='go__start-picker'>
          <PlaceSearch state={state} label={t('route.startingPoint')} placeholder={t('route.startPlaceholder')} autoFocus onPick={(p) => { onStart(p); setSettingStart(false) }} />
          <div className='go__start-actions'>
            <button type='button' className='pill-button' onClick={locate} disabled={locating === 'busy'}><LocateIcon className='go__btn-icon' />{locating === 'busy' ? t('route.finding') : t('route.useLocation')}</button>
            <button type='button' className='go__link-button' onClick={() => setSettingStart(false)}>{t('common.cancel')}</button>
          </div>
          {locating === 'failed' && <p className='go__hint'>{t('route.locateFailed')}</p>}
        </div>
      )}

      {stops.length > 0 ? (
        <ol className='go__stops' ref={listRef}>
          {stops.map((stop, i) => {
            const arrive = arriving[i] ?? null
            const leg = i > 0 || start ? <span className='go__leg'>{arrive && legLabel ? legLabel(arrive) : legText(arrive, unit)}</span> : null
            const stay = stays?.of(i)
            const stayMinutes = stay ? stay.minutes ?? stay.suggested : null
            const text = <><span className='go__stop-n'>{i + 1}</span><span className='go__stop-text'><strong>{stop.name}</strong>{describe(stop, i)}</span></>
            return (
              <li key={stop.locId ?? `${stop.lat},${stop.lng}`} className={`go__stop ${dragging === i ? 'is-dragging' : ''} ${activeStop === i ? 'is-active' : ''}`} data-testid='route-row'>
                {leg}
                <div className='go__stop-row'>
                  {editing && (
                    <span className='go__drag' role='presentation' title={t('route.drag')} onPointerDown={startDrag(i)}><DragIcon /></span>
                  )}
                  {onStopClick
                    ? <button type='button' className='go__stop-main' onClick={() => onStopClick(stop, i)}>{text}</button>
                    : <span className='go__stop-main'>{text}</span>}
                  {editing && (
                    <span className='go__stop-tools'>
                      <button type='button' className='go__icon-button' aria-label={t('route.moveUp', { name: stop.name })} disabled={i === 0} onClick={() => onStops(move(stops, i, i - 1))}><ChevronIcon className='is-up' /></button>
                      <button type='button' className='go__icon-button' aria-label={t('route.moveDown', { name: stop.name })} disabled={i === stops.length - 1} onClick={() => onStops(move(stops, i, i + 1))}><ChevronIcon /></button>
                      <button type='button' className='go__icon-button' aria-label={t('route.remove', { name: stop.name })} onClick={() => onStops(stops.filter((_, j) => j !== i))}><CloseIcon /></button>
                    </span>
                  )}
                </div>
                {stay && (editing
                  ? <StayStepper name={stop.name} stay={stay} onChange={(minutes) => stays!.onChange(i, minutes)} />
                  : stayMinutes !== null && (
                    <p className='go__stay'>
                      {t('routeTimes.stay', { time: duration(stayMinutes) })}
                      {stay.minutes === null && <> <span className='go__stay-tag'>{t('routeTimes.suggested')}</span></>}
                    </p>
                  ))}
              </li>
            )
          })}
          {preview && (
            <li className='go__stop is-preview' aria-live='polite'>
              {(stops.length > 0 || start) && <span className='go__leg'>{t('route.legAbout', { distance: shortDistance(Math.round(roadKm(stops[stops.length - 1] ?? start!, preview) / 1.609344 * 10) / 10, unit) })}</span>}
              <div className='go__stop-row'>
                <span className='go__stop-main'>
                  <span className='go__stop-n'>{stops.length + 1}</span>
                  <span className='go__stop-text'><strong>{preview.name}</strong><span>{t('route.preview', { note: preview.note || t('route.notOnRoute') })}</span></span>
                </span>
              </div>
            </li>
          )}
        </ol>
      ) : <p className='go__hint'>{t('route.noStops')}</p>}

      {between}

      {editing && inline && (
        <div className='go__add'>
          {full
            ? <p className='go__hint'>{t('route.full', { count: MAX_ROUTE_STOPS })}</p>
            : adding
              ? <>
                  <PlaceSearch state={state} label={t('route.addStop')} placeholder={t('route.addPlaceholder')} onPick={addStop} autoFocus
                    suggestions={fresh.slice(0, 6)} suggestionsLabel={suggestionsLabel} />
                  <button type='button' className='go__link-button' onClick={() => setAdding(false)}>{t('common.cancel')}</button>
                </>
              : <button type='button' className='go__add-row' onClick={() => setAdding(true)} data-testid='add-stop'>{t('route.addStopRow')}</button>}
        </div>
      )}
      {editing && !inline && (
        <>
          <div className='go__add'>
            {full
              ? <p className='go__hint'>{t('route.full', { count: MAX_ROUTE_STOPS })}</p>
              : <PlaceSearch state={state} label={t('route.addStop')} placeholder={t('route.addPlaceholder')} onPick={addStop}
                  suggestions={fresh.slice(0, 5)} suggestionsLabel={suggestionsLabel} />}
          </div>
          <div className='go__route-actions'>
            {stops.length > 2 && <button type='button' className='pill-button' onClick={() => onStops(shortestOrder(stops, start))}>{t('route.shortest')}</button>}
            {custom && <button type='button' className='pill-button' onClick={onReset}>{resetLabel ?? t('route.backSuggested')}</button>}
            <button type='button' className='pill-button pill-button--primary' onClick={() => { setSettingStart(false); onDone() }}>{t('route.done')}</button>
          </div>
        </>
      )}
    </>
  )
}

export default RouteEditor
