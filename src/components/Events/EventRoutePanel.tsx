import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import SightingsMap from '../SightingsMap/SightingsMap'
import RouteEditor from '../RouteEditor/RouteEditor'
import { RouteTotals } from './EventRoute'
import { RouteLinks } from './DayView'
import { useGroupRoute } from './useGroupRoute'
import { customRoute, speciesByPlace, stayTotal, withStays } from './customRoute'
import { editedAgo } from './editedAgo'
import { useDriveQuery, useEventRouteQuery, useEventScoutingQuery } from '../../hooks/queries'
import { isNetworkError } from '../../offline'
import { routeLinks, shortestOrder, type PlanPoint } from '../../routePlan'
import { prefersReducedMotion } from '../../routeDraw'
import { duration } from '../../duration'
import { shortDistance, useDistanceUnit } from '../../distance'
import { t } from '../../i18n'
import type { GroupEvent } from '../../types'

const MAP_SMALL = 220
const MAP_LARGE = 420

/**
 * The event's route, high on its page and open from the start: the group's saved route, or the
 * suggestion until anyone changes it. The list is the editor (meeting point and time, drag or
 * arrows to reorder, a stay stepper, remove, "+ Add a stop"); the first change to the suggestion
 * saves it as the group's route. A compact map above, its numbered stops tied to the rows. Less
 * used actions sit behind "⋯". Edits wait on the phone with no signal and save when it's back.
 */
const EventRoutePanel = ({ event, onDay }: { event: GroupEvent; onDay: boolean }) => {
  const unit = useDistanceUnit()
  const scouting = useEventScoutingQuery(event.id)
  const reports = useMemo(() => scouting.data?.reported ?? [], [scouting.data?.reported])
  const lifers = scouting.data?.using === 'likely_lifers'
  const group = useGroupRoute(event.id, true, onDay)
  const routeQuery = useEventRouteQuery(event.id, true)
  const suggested = routeQuery.data
  const start = group.current?.start ?? null
  const customStops = group.current?.stops ?? null
  const custom = customStops !== null
  const toPoint = (s: { locId: string; locName: string; lat: number; lng: number }): PlanPoint => ({ locId: s.locId || null, name: s.locName, lat: s.lat, lng: s.lng })
  const drivePoints = useMemo(() => [...(start ? [start] : []), ...(customStops ?? [])].map(p => ({ lat: p.lat, lng: p.lng })), [start, customStops])
  const drive = useDriveQuery(drivePoints, custom)
  const shownStops = withStays(customStops ?? (suggested?.stops ?? []).map(toPoint), group.saved?.stops, suggested)
  const route = custom
    ? customRoute({ suggested, reported: reports, stops: shownStops, start, drive: drive.data, driveFailed: drive.isError, server: group.unsaved ? null : group.saved })
    : suggested

  // Every change saves the whole route as the group's: the first one turns the suggestion into it.
  const keep = (stops: PlanPoint[]) => stops.map(stop => ({ locId: stop.locId, name: stop.name, lat: stop.lat, lng: stop.lng, stay_min: (stop as { stay_min?: number | null }).stay_min ?? null }))
  const editStops = (stops: PlanPoint[]) => group.edit({ start, stops: keep(stops) })
  const editStay = (i: number, minutes: number | null) => group.edit({ start, stops: keep(shownStops).map((stop, j) => (j === i ? { ...stop, stay_min: minutes } : stop)) })
  const editStart = (next: PlanPoint | null) => group.edit({ start: next ? { name: next.name, lat: next.lat, lng: next.lng, time: start?.time ?? null } : null, stops: keep(shownStops) })
  const editTime = (time: string | null) => { if (start) group.edit({ start: { ...start, time }, stops: keep(shownStops) }) }

  // What a place would add: the suggestion's extras and stops, then every place in the scouting reports.
  const speciesAt = useMemo(() => speciesByPlace(suggested, reports), [suggested, reports])
  const newAt = (() => {
    const covered = new Set<string>()
    return shownStops.map(stop => {
      const fresh = speciesAt(stop.locId).filter(code => !covered.has(code))
      fresh.forEach(code => covered.add(code))
      return fresh.length
    })
  })()
  const coveredNow = new Set(shownStops.flatMap(stop => speciesAt(stop.locId)))
  const reportPlaces = reports.filter(r => r.locId && typeof r.lat === 'number' && typeof r.lng === 'number')
    .map(r => ({ locId: r.locId!, name: r.locName ?? r.locId!, lat: r.lat as number, lng: r.lng as number }))
  const candidates = [...(suggested?.extras ?? []).map(toPoint), ...(suggested?.stops ?? []).map(toPoint), ...reportPlaces]
    .filter((p, i, all) => all.findIndex(q => q.locId === p.locId) === i)
  const suggestions = candidates
    .map(point => ({ point, adds: speciesAt(point.locId).filter(code => !coveredNow.has(code)).length }))
    .filter(({ adds }) => adds > 0)
    .sort((a, b) => b.adds - a.adds)
    .map(({ point, adds }) => ({ point, detail: t('eventRoute.extraBirds', { count: adds }) }))

  // The map and the list point at each other.
  const [active, setActive] = useState<number | null>(null)
  const [big, setBig] = useState(false)
  const pickStop = (i: number) => {
    setActive(i)
    document.querySelectorAll('#route [data-testid="route-row"]')[i]?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }
  const routeOnMap = route && route.stops.length > 0
    ? {
        path: route.geometry, stops: route.stops.map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.locName}` })),
        start: route.from ? { ...route.from, label: start?.name ?? t('eventRoute.meetingPoint') } : null,
        onStop: pickStop, activeStop: active
      }
    : null

  // The ⋯ menu: back to the suggestion (asked first), the whole route in Google Maps, start from here.
  const [menu, setMenu] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating('idle'); setMenu(false); editStart({ locId: null, name: t('route.myLocation'), lat: Math.round(pos.coords.latitude * 1e4) / 1e4, lng: Math.round(pos.coords.longitude * 1e4) / 1e4 }) },
      () => setLocating('failed'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }
  const links = route ? routeLinks(route.stops.map(s => ({ locId: s.locId || null, name: s.locName, lat: s.lat, lng: s.lng })), start ? { locId: null, ...start } : null) : []
  const partLabel = (from: number | null, to: number) => (from === null ? t('eventDay.partFromMeet', { to }) : t('eventDay.partStops', { from, to }))

  // An email's route button links to /events/<id>#route.
  const { hash } = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const shown = useRef(false)
  useEffect(() => {
    if (hash !== '#route' || shown.current || !route) return
    shown.current = true
    panelRef.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [hash, route])

  const saved = group.saved
  const heading = custom
    ? [
        t('eventRoute.groupRoute'),
        saved && saved.version > 0 ? (saved.updated_by_you ? t('eventRoute.editedByYou') : saved.updated_by_name ? t('eventRoute.editedBy', { name: saved.updated_by_name }) : t('eventRoute.editedByMember')) : null,
        saved?.updated_at ? editedAgo(saved.updated_at) : null
      ].filter(Boolean).join(' · ')
    : t('eventRoute.suggestedHeading')
  const loading = !route && (routeQuery.isPending || group.query.isPending)
  const failed = !route && !loading && routeQuery.isError
  const statusText = group.status === 'saving' ? t('eventRoute.saving')
    : group.status === 'waiting' ? t('eventRoute.waiting')
      : group.status === 'saved' ? t('eventRoute.saved')
        : group.status === 'failed' ? t('eventRoute.saveFailed')
          : group.note ? (group.note.updated_by_name ? t('eventRoute.changedBy', { name: group.note.updated_by_name }) : t('eventRoute.changed')) : ''

  return (
    <div className='event-page__section event-route-panel' id='route' ref={panelRef} data-testid='event-route'>
      <div className='event-route-panel__head'>
        <h2 className='place__heading' data-testid='route-heading'>{heading}</h2>
        <button type='button' className='go__icon-button event-route-panel__more' aria-label={t('eventRoute.more')} aria-expanded={menu} onClick={() => setMenu(m => !m)} data-testid='route-menu'>⋯</button>
      </div>
      {!custom && <p className='notification__hint event-route-panel__hint'>{t('eventRoute.suggestedHint')}</p>}
      {menu && (
        <div className='event-route-panel__menu' role='menu' data-testid='route-menu-items'>
          {custom && <button type='button' role='menuitem' className='link-button link-text' onClick={() => { setConfirmReset(true); setMenu(false) }}>{t('eventRoute.backSuggested')}</button>}
          <button type='button' role='menuitem' className='link-button link-text' disabled={locating === 'busy'} onClick={locate}>{locating === 'busy' ? t('route.finding') : t('eventRoute.startHere')}</button>
          {locating === 'failed' && <p className='go__hint'>{t('route.locateFailed')}</p>}
          {route && route.stops.length > 1 && <button type='button' role='menuitem' className='link-button link-text' onClick={() => { editStops(shortestOrder(shownStops, start ? { locId: null, ...start } : null)); setMenu(false) }}>{t('route.shortest')}</button>}
          <RouteLinks links={links} partLabel={partLabel} />
        </div>
      )}
      {confirmReset && (
        <p className='place__actions event__confirm' role='alert'>
          <span>{t('eventRoute.resetSure')}</span>
          <button type='button' className='pill-button pill-button--small' disabled={group.resetting} onClick={() => void group.reset().then(ok => { if (ok) setConfirmReset(false) })}>{t('eventRoute.resetYes')}</button>
          <button type='button' className='link-button link-text' onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
        </p>
      )}
      {group.offer && (
        <p className='place__actions event__confirm event-route__offer' role='alert'>
          <span>{t('eventRoute.offer')}</span>
          <button type='button' className='pill-button pill-button--small' onClick={group.acceptOffer}>{t('eventRoute.offerSave')}</button>
          <button type='button' className='link-button link-text' onClick={group.declineOffer}>{t('eventRoute.offerDiscard')}</button>
        </p>
      )}
      {/* Saving…, Saved, waiting for signal and someone else's change share one line that is always
          there at the same height, so nothing below it moves while someone is tapping. */}
      <p className={`event-route__status ${statusText ? '' : 'is-empty'}`} role='status' data-testid='route-status'>{statusText}</p>
      {loading && (
        <div className='route-skeleton' aria-busy='true' aria-label={t('eventRoute.loading')} data-testid='route-skeleton'>
          <span className='route-skeleton__map' />
          <span className='route-skeleton__row' />
          <span className='route-skeleton__row' />
          <span className='route-skeleton__row' />
        </div>
      )}
      {failed && <p className='notification__hint'>{isNetworkError(routeQuery.error) ? t('offline.noSignalNothingSaved') : t('eventRoute.failed')}</p>}
      {route && !custom && route.incomplete && <p className='event-route__note'>{t('eventRoute.incomplete')}</p>}
      {route && route.stops.length > 0 && !route.routed && <p className='event-route__note' data-testid='route-unrouted'>{t(custom ? 'eventRoute.unroutedCustom' : 'eventRoute.unrouted')}</p>}
      {routeOnMap && (
        <div className='event-route-panel__map'>
          <SightingsMap points={[]} route={routeOnMap} height={big ? MAP_LARGE : MAP_SMALL} ariaLabel={t('scoutingView.map', { name: event.name })} />
          <button type='button' className='link-button link-text event-route-panel__grow' onClick={() => setBig(b => !b)} data-testid='map-size'>{big ? t('eventRoute.mapSmaller') : t('eventRoute.mapBigger')}</button>
        </div>
      )}
      {(route || custom) && !loading && (
        <div className='go__route is-editing event-route__editor' data-testid='route-editor'>
          <RouteEditor state={event.state} stops={shownStops} start={start ? { locId: null, ...start } : null} editing inline
            arriving={route ? route.stops.map(s => (typeof s.leg_min === 'number' && typeof s.leg_mi === 'number' ? { minutes: s.leg_min, miles: s.leg_mi } : null)) : []}
            describe={(_stop, i) => <span>{newAt[i] ? t('eventRoute.newBirds', { count: newAt[i] }) : t('eventRoute.noNewBirds')}</span>}
            suggestions={suggestions} suggestionsLabel={t('eventRoute.addFromList')} custom={custom}
            between={route && route.stops.length > 0 && (
              <>
                <RouteTotals drive={route.routed ? route.total_min : null} stay={stayTotal(shownStops)} />
                <p className='go__covers'>{t(lifers ? 'eventRoute.coversLifers' : 'eventRoute.covers', { got: route.covered, count: route.reported })}</p>
              </>
            )}
            stays={{ of: (i) => ({ minutes: shownStops[i]?.stay_min ?? null, suggested: shownStops[i]?.suggested_stay_min ?? null }), onChange: editStay }}
            legLabel={(leg) => t('eventRoute.leg', { time: duration(leg.minutes), distance: shortDistance(leg.miles, unit) })}
            onStops={editStops} onStart={editStart} onReset={() => setConfirmReset(true)} onDone={() => undefined}
            onStopClick={(_stop, i) => setActive(i)} activeStop={active}
            resetLabel={t('eventRoute.backSuggested')} startLabel={t('eventRoute.meetingPoint')} startEmpty={t('eventRoute.noMeetingPoint')}
            startTime={{ value: start?.time ?? null, onChange: editTime, label: t('eventDay.meetingTime') }} />
        </div>
      )}
    </div>
  )
}

export default EventRoutePanel
