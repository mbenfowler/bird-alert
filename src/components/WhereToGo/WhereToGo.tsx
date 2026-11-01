import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import NearbyPublic from '../NearbyPublic/NearbyPublic'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import RouteCard from './RouteCard'
import { useCurrentUser, useDriveQuery, useNearbyPublicQuery, useRegionsQuery } from '../../hooks/queries'
import { focusFor } from '../../mapFocus'
import { unitFor } from '../../distance'
import { chanceColour } from '../../chance'
import { MAX_ROUTE_STOPS, coverage, samePlace, mapsUrl, type PlanPoint } from '../../routePlan'
import { useGoPlan } from '../../hooks/useGoPlan'
import { useDocked } from '../../hooks/useDocked'
import { shareThing } from '../../share'
import type { GoPlace } from '../../types'
import AccuracyBadge from '../AccuracyBadge/AccuracyBadge'
import './WhereToGo.css'
import { countyWord } from '../../usStates'
import { number, t } from '../../i18n'
import { Trans } from 'react-i18next'

const birdsWord = (n: number) => t('route.birds', { count: n, n: number(n, { maximumFractionDigits: 1 }) })

/**
 * Where to go for the whole watch list: the places that offer the most of your birds, a short
 * route that covers the most different ones, and the birds each place holds. Same one-screen frame
 * as the species page: the route card leads, the map and list dock under the bar.
 */
const WhereToGo = () => {
  const user = useCurrentUser()
  const distanceUnit = unitFor(user.state)
  const region = user.location
  const { custom, setCustom, start, setStart, saveFailed, seen, lifers, setLiferMode, codes, go, route, stops } = useGoPlan(region)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? t('range.yourCounty', { word: countyWord(user.state) })
  const [selected, setSelected] = useState<string | null>(null)
  // One private place at a time can open its public lands; the map focuses on them meanwhile.
  const [openNearby, setOpenNearby] = useState<string | null>(null)
  const [activeNearby, setActiveNearby] = useState<string | null>(null)
  const [showRoute, setShowRoute] = useState(false)
  const [editing, setEditing] = useState(false)
  // A public land the mouse rests on, shown on the end of the route until the mouse moves off.
  const [phantom, setPhantom] = useState<PlanPoint | null>(null)

  // A route of one's own is driven here; the suggested one comes with its drive.
  const drivePoints = useMemo(() => [...(start ? [start] : []), ...stops].map(p => ({ lat: p.lat, lng: p.lng })), [start, stops])
  const ownDrive = useDriveQuery(drivePoints, custom !== null && stops.length > 0)
  const drive = custom ? (ownDrive.isPlaceholderData ? null : ownDrive.data ?? null) : route?.drive ?? null
  const driveFromStart = custom ? Boolean(start) : Boolean(route?.origin)
  const arriving = stops.map((_, i) => { const k = driveFromStart ? i : i - 1; return k >= 0 ? drive?.legs?.[k] ?? null : null })

  const places = useMemo(() => go.data?.places ?? [], [go.data])
  const points = useMemo<MapPoint[]>(() => places.filter(p => p.lat !== null && p.lng !== null).map(p => ({
    id: p.locId,
    lat: p.lat!,
    lng: p.lng!,
    title: p.locName ?? p.locId,
    subtitle: `${birdsWord(p.expected)} expected${p.bestTime ? ` · best ${p.bestTime}` : ''}`,
    highlight: p.locId === selected
  })), [places, selected])

  const nearbyPlace = useMemo(() => places.find(p => p.locId === openNearby) ?? null, [places, openNearby])
  const nearby = useNearbyPublicQuery(nearbyPlace?.lat ?? null, nearbyPlace?.lng ?? null, Boolean(nearbyPlace))
  const focus = useMemo(() => nearbyPlace && nearbyPlace.lat !== null && nearbyPlace.lng !== null && nearby.data
    ? { ...focusFor({ lat: nearbyPlace.lat, lng: nearbyPlace.lng, label: nearbyPlace.locName ?? nearbyPlace.locId }, nearby.data, distanceUnit), activeId: activeNearby, onTargetClick: (id: string) => setActiveNearby(current => current === id ? null : id) }
    : null, [nearbyPlace, nearby.data, activeNearby, distanceUnit])
  const closeNearby = () => { setOpenNearby(null); setActiveNearby(null) }

  // Docking, as on the species page: the list scrolls by itself only once the frame is under the bar.
  const { frameRef, docked } = useDocked(places.length)

  // Starting an edit, or showing the route, brings the map under the bar: on a phone the button
  // sits above the map, and the route draws itself only once the map is in view.
  const routeShown = editing || showRoute
  useEffect(() => {
    if (!routeShown) return
    const frame = frameRef.current
    if (!frame) return
    const bar = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 55
    const gap = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--dock-gap')) || 0
    window.scrollTo({ top: window.scrollY + frame.getBoundingClientRect().top - bar - gap, behavior: 'smooth' })
  }, [routeShown, frameRef])

  const modeSwitch = seen.codes.size > 0 && (
    <label className='go__mode'>
      <input className='switch switch--small' type='checkbox' checked={lifers} onChange={(e) => setLiferMode(e.target.checked)} />
      <span><strong>{t('go.lifersFirst')}</strong> <span className='go__mode-hint'>{lifers ? t('go.lifersOn') : t('go.lifersOff')}</span></span>
    </label>
  )

  if (!codes.length) {
    return (
      <section className='go'>
        <h1 className='fredericka go__title'>{t('go.tabsLabel')}</h1>
        {modeSwitch}
        {lifers
          ? <p className='list-note'><Trans i18nKey='go.allSeen' values={{ regionName }} /></p>
          : <p className='list-note'><Trans i18nKey='go.noBirds' components={{ home: <Link to='/' /> }} /></p>}
      </section>
    )
  }
  if (go.isError) return <ErrorMessage networkError={errorMessage(go.error)} />
  if (go.isPending) return <LoadingState label={t('go.working')} />

  const { species } = go.data
  // An area chosen in the last hour or so has no checklists on file yet; say so rather than look empty.
  const gathering = (go.data.onFile?.checklists ?? Infinity) < 20
  // In lifer mode the list is the whole county; only the birds with a place to go count.
  const possibleLifers = species.filter(sp => sp.places > 0).length
  const select = (place: GoPlace) => setSelected(place.locId)
  const straightPath = drivePoints.map(p => [p.lat, p.lng] as [number, number])
  const preview = phantom && !stops.some(st => samePlace(st, phantom)) ? phantom : null
  const last = stops.length ? stops[stops.length - 1] : start
  const routeOnMap = ((showRoute || editing) && stops.length > 0 && drivePoints.length >= 2) || preview
    ? {
        // An edited route keeps its last roads while the new ones come (settling), then draws on.
        path: drivePoints.length >= 2 ? (custom ? ownDrive.data?.geometry : drive?.geometry) ?? straightPath : [],
        settling: custom !== null && ownDrive.isFetching,
        stops: stops.map(s => ({ lat: s.lat, lng: s.lng, label: s.name })),
        start: start ? { lat: start.lat, lng: start.lng, label: t('go.startLabel', { name: start.name }) } : null,
        preview: preview && last ? { lat: preview.lat, lng: preview.lng, label: preview.name, from: [last.lat, last.lng] as [number, number] } : null
      }
    : null
  const routeTools = {
    has: (point: PlanPoint) => stops.some(st => samePlace(st, point)),
    toggle: (point: PlanPoint) => setCustom(stops.some(st => samePlace(st, point)) ? stops.filter(st => !samePlace(st, point)) : [...stops, point].slice(0, MAX_ROUTE_STOPS)),
    preview: setPhantom,
    full: stops.length >= MAX_ROUTE_STOPS
  }

  // A place from the list goes on the end of the route (making it the person's own), or comes off it.
  const toggleStop = (place: GoPlace) => {
    if (place.lat === null || place.lng === null) return
    if (stops.some(st => st.locId === place.locId)) setCustom(stops.filter(st => st.locId !== place.locId))
    else if (stops.length < MAX_ROUTE_STOPS) setCustom([...stops, { locId: place.locId, name: place.locName ?? place.locId, lat: place.lat, lng: place.lng }])
  }
  const hasRoute = stops.length > 0 || custom !== null
  const routeCard = hasRoute ? (
    <RouteCard state={user.state} places={places} speciesCount={lifers ? possibleLifers : species.length} lifers={lifers} stops={stops} start={start} arriving={arriving}
            preview={preview} drive={drive} covers={custom ? coverage(stops, places) : route!.covers} url={custom ? mapsUrl(stops, start) : route!.url}
            custom={custom !== null} saveFailed={saveFailed} editing={editing} showRoute={showRoute}
            onEditing={(on) => { setEditing(on); if (on) { closeNearby(); setShowRoute(true) } }}
            onStops={(next) => setCustom(next)} onStart={setStart} onReset={() => setCustom(null)}
            onStopClick={(stop) => { if (stop.locId) setSelected(stop.locId); setShowRoute(true) }}
            onToggleRoute={() => setShowRoute(v => !v)}
            onShare={() => {
              const byId = new Map(places.map(p => [p.locId, p]))
              const covered = custom ? coverage(stops, places) : route!.covers
              void shareThing({
                kind: 'route',
                regionName,
                covers: lifers ? null : t('go.shareCovers', { birds: birdsWord(covered), count: species.length }),
                stops: stops.map(s => {
                  const place = s.locId ? byId.get(s.locId) : undefined
                  return {
                    name: s.name, lat: s.lat, lng: s.lng, locId: s.locId,
                    detail: place ? (place.bestTime ? t('route.expectedBest', { birds: birdsWord(place.expected), best: place.bestTime }) : t('route.expected', { birds: birdsWord(place.expected) })) : s.note ?? null,
                    birds: (place?.birds ?? []).slice(0, 4).map(b => `${b.comName} ${b.chance}%`)
                  }
                }),
                // The drive is shared from the first stop on: the start (often home) stays private.
                drive: drive ? (start
                  ? (() => { const legs = arriving.slice(1); return legs.length && legs.every(Boolean) ? { minutes: legs.reduce((n, l) => n + l!.minutes, 0), miles: Math.round(legs.reduce((n, l) => n + l!.miles, 0) * 10) / 10, legs, geometry: [] } : null })()
                  : { minutes: drive.minutes, miles: drive.miles, legs: arriving.slice(1), geometry: drive.geometry }) : null
              }, t('go.shareTitle', { regionName }))
            }} />
  ) : null

  return (
    <section className={`go ${editing ? 'is-editing-route' : ''}`}>
      <header className='go__hero'>
        <div className='go__title-row'>
          <h1 className='fredericka go__title'>{t('go.tabsLabel')}</h1>
          {modeSwitch}
          <p className='go__summary'>{lifers ? t('go.possibleLifers', { count: possibleLifers }) : t('go.watchCount', { count: species.length })} · {t('go.placesIn', { count: places.length, regionName })}</p>
          <AccuracyBadge grades={go.data.grades} />
        </div>
        {!editing && routeCard}
      </header>

      <div className={`go__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
        <div className='go__map'>
          {points.length
            ? <SightingsMap points={points} focus={focus} route={focus && !preview ? null : routeOnMap} height='100%' ariaLabel={t('go.mapLabel', { regionName })} openHighlighted={!focus}
                onPinClick={(hit) => { const p = places.find(x => x.locId === hit[0]?.id); if (!p) return; if (openNearby && p.locId !== openNearby) closeNearby(); select(p) }} />
            : <p className='list-note go__nomap'>{places.length ? t('go.noCoords') : t('go.noPlaces')}</p>}
        </div>
        <div className='go__list-col'>
          <div className='go__scroll'>
            {/* Editing, the route takes the list's place beside the map, so each change shows as it is made. */}
            {editing && routeCard}
            {!editing && <>
            <h2 className='fredericka go__subhead'>{t('go.bestPlaces')}</h2>
            {!places.length && <p className='list-note go__empty'>{gathering
              ? t('go.gathering', { regionName, word: countyWord(user.state) })
              : t('go.noneReported', { regionName })}</p>}
            <ol className='go__places'>
              {places.map(place => (
                <li key={place.locId} className={`go__place ${place.locId === selected ? 'is-current' : ''}`}>
                  <button type='button' className='go__place-head' onClick={() => select(place)} aria-current={place.locId === selected ? 'true' : undefined}>
                    <span className='go__expected'>{birdsWord(place.expected)}</span>
                    <strong>{place.locName ?? place.locId}</strong>
                    {place.isHotspot === false && <span className='place__private'>{t('sighting.private')}</span>}
                    {place.seenToday && <span className='go__today'>{t('sighting.today')}</span>}
                    {place.bestTime && <span className='go__place-meta'>{t('go.best', { when: place.bestTime })}</span>}
                  </button>
                  <div className='go__birds'>
                    {place.birds.slice(0, 8).map(b => (
                      <Link key={b.speciesCode} className='go__bird' style={{ '--chance': chanceColour(b.chance) } as CSSProperties} to={`/sighting/${b.speciesCode}/${b.lastSeen?.subId ?? ''}`}>{b.comName} {b.chance}%</Link>
                    ))}
                    {place.birds.length > 8 && <span className='go__more'>{t('go.more', { count: place.birds.length - 8 })}</span>}
                  </div>
                  {place.isHotspot !== false && place.lat !== null && place.lng !== null && (() => {
                    const on = stops.some(st => st.locId === place.locId)
                    return (
                      <button type='button' className={`pill-button go__quick-add ${on ? 'is-on' : ''}`} aria-pressed={on}
                        disabled={!on && stops.length >= MAX_ROUTE_STOPS} title={!on && stops.length >= MAX_ROUTE_STOPS ? t('best.routeFull', { count: MAX_ROUTE_STOPS }) : undefined}
                        onClick={() => toggleStop(place)}>
                        {on ? t('go.onRoute') : t('go.addRoute')}
                      </button>
                    )
                  })()}
                  {place.isHotspot === false && place.lat !== null && (
                    <NearbyPublic placeName={place.locName ?? place.locId} open={openNearby === place.locId}
                      onOpen={() => { setOpenNearby(place.locId); setActiveNearby(null); setSelected(place.locId) }}
                      data={openNearby === place.locId ? nearby.data : undefined} isPending={openNearby === place.locId && nearby.isPending} isError={openNearby === place.locId && nearby.isError}
                      activeId={activeNearby} onPick={(id) => setActiveNearby(current => current === id ? null : id)} onClose={() => { setPhantom(null); closeNearby() }} route={routeTools} />
                  )}
                </li>
              ))}
            </ol>
            </>}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhereToGo
