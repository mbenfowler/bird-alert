import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import NearbyPublic from '../NearbyPublic/NearbyPublic'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import RouteCard from './RouteCard'
import { useCurrentUser, useDriveQuery, useNearbyPublicQuery, useRegionsQuery, useSavedCodes, useSeenCodes, useSpeciesListQuery, useWhereToGoQuery } from '../../hooks/queries'
import { focusFor } from '../../mapFocus'
import { unitFor } from '../../distance'
import { chanceColour } from '../../chance'
import { MAX_ROUTE_STOPS, coverage, samePlace, mapsUrl, type PlanPoint } from '../../routePlan'
import { useRoutePlan } from '../../hooks/useRoutePlan'
import { shareThing } from '../../share'
import type { GoPlace } from '../../types'
import AccuracyBadge from '../AccuracyBadge/AccuracyBadge'
import './WhereToGo.css'
import { countyWord } from '../../usStates'

const LIFER_MODE_KEY = 'bird-alert:go-lifers'
const readLiferMode = () => { try { return localStorage.getItem(LIFER_MODE_KEY) === '1' } catch { return false } }

const birdsWord = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? 'bird' : 'birds'}`

/**
 * Where to go for the whole watch list: the places that offer the most of your birds, a short
 * route that covers the most different ones, and the birds each place holds. Same one-screen frame
 * as the species page: the route card leads, the map and list dock under the bar.
 */
const WhereToGo = () => {
  const user = useCurrentUser()
  const distanceUnit = unitFor(user.state)
  const region = user.location
  const savedCodes = useSavedCodes()
  // Only the watch-list birds that occur in this county are worth asking about; a long list saved
  // across many places would otherwise go over the wire for nothing.
  const speciesList = useSpeciesListQuery(region)
  // Lifers first: every bird of the county that isn't on the life list, in place of the watch list.
  const seen = useSeenCodes()
  const [liferMode, setLiferModeState] = useState(readLiferMode)
  const setLiferMode = (on: boolean) => { setLiferModeState(on); try { localStorage.setItem(LIFER_MODE_KEY, on ? '1' : '0') } catch { /* this visit only */ } }
  const lifers = liferMode && seen.codes.size > 0
  const codes = useMemo(() => {
    if (lifers) return (speciesList.data ?? []).filter(code => !seen.codes.has(code)).sort()
    const here = speciesList.data ? new Set(speciesList.data) : null
    return [...savedCodes].filter(code => !here || here.has(code)).sort()
  }, [lifers, savedCodes, seen.codes, speciesList.data])
  // The person's own stops for this county (null follows the suggestion) and where the day starts,
  // kept on the account. The suggested route counts the drive from the start.
  const { custom, setCustom, start, setStart, saveFailed } = useRoutePlan(region)
  const go = useWhereToGoQuery(region, codes, start)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? `your ${countyWord(user.state)}`
  const [selected, setSelected] = useState<string | null>(null)
  // One private place at a time can open its public lands; the map focuses on them meanwhile.
  const [openNearby, setOpenNearby] = useState<string | null>(null)
  const [activeNearby, setActiveNearby] = useState<string | null>(null)
  const [showRoute, setShowRoute] = useState(false)
  const [editing, setEditing] = useState(false)
  // A public land the mouse rests on, shown on the end of the route until the mouse moves off.
  const [phantom, setPhantom] = useState<PlanPoint | null>(null)

  const route = go.data?.route
  const suggested = useMemo<PlanPoint[]>(() => (route?.stops ?? []).map(s => ({ locId: s.locId, name: s.locName ?? s.locId, lat: s.lat, lng: s.lng })), [route])
  const stops = custom ?? suggested
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
  const frameRef = useRef<HTMLDivElement>(null)
  const [docked, setDocked] = useState(false)
  useEffect(() => {
    const update = () => {
      const frame = frameRef.current
      if (!frame) return
      const bar = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 55
      const gap = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--dock-gap')) || 0
      setDocked(frame.getBoundingClientRect().top <= bar + gap + 1)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [places.length])

  // Starting an edit brings the map and the route under the bar together.
  useEffect(() => {
    if (!editing) return
    const frame = frameRef.current
    if (!frame) return
    const bar = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 55
    const gap = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--dock-gap')) || 0
    window.scrollTo({ top: window.scrollY + frame.getBoundingClientRect().top - bar - gap, behavior: 'smooth' })
  }, [editing])

  const modeSwitch = seen.codes.size > 0 && (
    <label className='go__mode'>
      <input className='switch switch--small' type='checkbox' checked={lifers} onChange={(e) => setLiferMode(e.target.checked)} />
      <span><strong>Lifers first</strong> <span className='go__mode-hint'>{lifers ? 'Places ranked by birds not on your life list' : 'Rank places by birds you’ve never seen'}</span></span>
    </label>
  )

  if (!codes.length) {
    return (
      <section className='go'>
        <h1 className='fredericka go__title'>Where to go</h1>
        {modeSwitch}
        {lifers
          ? <p className='list-note'>Every bird on {regionName}’s list is already on your life list. Nice work.</p>
          : <p className='list-note'>Add birds to your watch list and this page will say where to find them. <Link to='/'>Pick some from the home page.</Link></p>}
      </section>
    )
  }
  if (go.isError) return <ErrorMessage networkError={errorMessage(go.error)} />
  if (go.isPending) return <LoadingState label='Working out where to go…' />

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
        path: drivePoints.length >= 2 ? drive?.geometry ?? straightPath : [],
        stops: stops.map(s => ({ lat: s.lat, lng: s.lng, label: s.name })),
        start: start ? { lat: start.lat, lng: start.lng, label: `Start: ${start.name}` } : null,
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
                covers: lifers ? null : `Covers about ${birdsWord(covered)} of a ${species.length}-bird watch list.`,
                stops: stops.map(s => {
                  const place = s.locId ? byId.get(s.locId) : undefined
                  return {
                    name: s.name, lat: s.lat, lng: s.lng, locId: s.locId,
                    detail: place ? `${birdsWord(place.expected)} expected${place.bestTime ? ` · best ${place.bestTime}` : ''}` : s.note ?? null,
                    birds: (place?.birds ?? []).slice(0, 4).map(b => `${b.comName} ${b.chance}%`)
                  }
                }),
                // The drive is shared from the first stop on: the start (often home) stays private.
                drive: drive ? (start
                  ? (() => { const legs = arriving.slice(1); return legs.length && legs.every(Boolean) ? { minutes: legs.reduce((n, l) => n + l!.minutes, 0), miles: Math.round(legs.reduce((n, l) => n + l!.miles, 0) * 10) / 10, legs, geometry: [] } : null })()
                  : { minutes: drive.minutes, miles: drive.miles, legs: arriving.slice(1), geometry: drive.geometry }) : null
              }, `A birding route in ${regionName}`)
            }} />
  ) : null

  return (
    <section className={`go ${editing ? 'is-editing-route' : ''}`}>
      <header className='go__hero'>
        <div className='go__title-row'>
          <h1 className='fredericka go__title'>Where to go</h1>
          {modeSwitch}
          <p className='go__summary'>{lifers ? `${possibleLifers} possible ${possibleLifers === 1 ? 'lifer' : 'lifers'} reported lately` : `${species.length} ${species.length === 1 ? 'bird' : 'birds'} on your watch list`} · {places.length} {places.length === 1 ? 'place' : 'places'} in {regionName} with reports in the last 30 days</p>
          <AccuracyBadge grades={go.data.grades} />
        </div>
        {!editing && routeCard}
      </header>

      <div className={`go__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
        <div className='go__map'>
          {points.length
            ? <SightingsMap points={points} focus={focus} route={focus && !preview ? null : routeOnMap} height='100%' ariaLabel={`Map of places for your watch list in ${regionName}`} openHighlighted={!focus}
                onPinClick={(hit) => { const p = places.find(x => x.locId === hit[0]?.id); if (!p) return; if (openNearby && p.locId !== openNearby) closeNearby(); select(p) }} />
            : <p className='list-note go__nomap'>{places.length ? 'None of these places have coordinates yet.' : 'No places to show yet.'}</p>}
        </div>
        <div className='go__list-col'>
          <div className='go__scroll'>
            {/* Editing, the route takes the list's place beside the map, so each change shows as it is made. */}
            {editing && routeCard}
            {!editing && <>
            <h2 className='fredericka go__subhead'>Best places for your birds</h2>
            {!places.length && <p className='list-note go__empty'>{gathering
              ? `We’re still gathering ${regionName}’s checklists. A newly chosen ${countyWord(user.state)} fills in within an hour or two, and the chances sharpen over the next few days as more checklists come in.`
              : `None of your birds have been reported in ${regionName} lately. Add a few more birds to widen the search.`}</p>}
            <ol className='go__places'>
              {places.map(place => (
                <li key={place.locId} className={`go__place ${place.locId === selected ? 'is-current' : ''}`}>
                  <button type='button' className='go__place-head' onClick={() => select(place)} aria-current={place.locId === selected ? 'true' : undefined}>
                    <span className='go__expected'>{birdsWord(place.expected)}</span>
                    <strong>{place.locName ?? place.locId}</strong>
                    {place.isHotspot === false && <span className='place__private'>private</span>}
                    {place.seenToday && <span className='go__today'>today</span>}
                    {place.bestTime && <span className='go__place-meta'>best {place.bestTime}</span>}
                  </button>
                  <div className='go__birds'>
                    {place.birds.slice(0, 8).map(b => (
                      <Link key={b.speciesCode} className='go__bird' style={{ '--chance': chanceColour(b.chance) } as CSSProperties} to={`/sighting/${b.speciesCode}/${b.lastSeen?.subId ?? ''}`}>{b.comName} {b.chance}%</Link>
                    ))}
                    {place.birds.length > 8 && <span className='go__more'>+{place.birds.length - 8} more</span>}
                  </div>
                  {place.isHotspot !== false && place.lat !== null && place.lng !== null && (() => {
                    const on = stops.some(st => st.locId === place.locId)
                    return (
                      <button type='button' className={`pill-button go__quick-add ${on ? 'is-on' : ''}`} aria-pressed={on}
                        disabled={!on && stops.length >= MAX_ROUTE_STOPS} title={!on && stops.length >= MAX_ROUTE_STOPS ? `A route takes up to ${MAX_ROUTE_STOPS} stops` : undefined}
                        onClick={() => toggleStop(place)}>
                        {on ? '✓ On route' : '+ Add to route'}
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
