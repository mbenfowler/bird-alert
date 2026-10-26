import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import NearbyPublic from '../NearbyPublic/NearbyPublic'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useNearbyPublicQuery, useRegionsQuery, useSavedCodes, useSpeciesListQuery, useWhereToGoQuery } from '../../hooks/queries'
import { focusFor } from '../../mapFocus'
import { chanceColour } from '../../chance'
import type { GoPlace } from '../../types'
import './WhereToGo.css'

const birdsWord = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? 'bird' : 'birds'}`

/**
 * Where to go for the whole watch list: the places that offer the most of your birds, a short
 * route that covers the most different ones, and the birds each place holds. Same one-screen frame
 * as the species page: the route card leads, the map and list dock under the bar.
 */
const WhereToGo = () => {
  const user = useCurrentUser()
  const region = user.location
  const savedCodes = useSavedCodes()
  // Only the watch-list birds that occur in this county are worth asking about; a long list saved
  // across many places would otherwise go over the wire for nothing.
  const speciesList = useSpeciesListQuery(region)
  const codes = useMemo(() => {
    const here = speciesList.data ? new Set(speciesList.data) : null
    return [...savedCodes].filter(code => !here || here.has(code)).sort()
  }, [savedCodes, speciesList.data])
  const go = useWhereToGoQuery(region, codes)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? 'your county'
  const [selected, setSelected] = useState<string | null>(null)
  // One private place at a time can open its public lands; the map focuses on them meanwhile.
  const [openNearby, setOpenNearby] = useState<string | null>(null)
  const [activeNearby, setActiveNearby] = useState<string | null>(null)
  const [showRoute, setShowRoute] = useState(false)

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
    ? { ...focusFor({ lat: nearbyPlace.lat, lng: nearbyPlace.lng, label: nearbyPlace.locName ?? nearbyPlace.locId }, nearby.data), activeId: activeNearby, onTargetClick: (id: string) => setActiveNearby(current => current === id ? null : id) }
    : null, [nearbyPlace, nearby.data, activeNearby])
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

  if (!codes.length) {
    return (
      <section className='go'>
        <h1 className='fredericka go__title'>Where to go</h1>
        <p className='list-note'>Add birds to your watch list and this page will say where to find them. <Link to='/'>Pick some from the home page.</Link></p>
      </section>
    )
  }
  if (go.isError) return <ErrorMessage networkError={errorMessage(go.error)} />
  if (go.isPending) return <LoadingState label='Working out where to go…' />

  const { route, species } = go.data
  const select = (place: GoPlace) => setSelected(place.locId)
  const routeOnMap = showRoute && route.stops.length >= 2
    ? { path: route.drive?.geometry ?? route.stops.map(s => [s.lat, s.lng] as [number, number]), stops: route.stops.map(s => ({ lat: s.lat, lng: s.lng, label: s.locName ?? s.locId })) }
    : null

  return (
    <section className='go'>
      <header className='go__hero'>
        <div className='go__title-row'>
          <h1 className='fredericka go__title'>Where to go</h1>
          <p className='go__summary'>{species.length} {species.length === 1 ? 'bird' : 'birds'} on your watch list · {places.length} {places.length === 1 ? 'place' : 'places'} in {regionName} with reports in the last 30 days</p>
        </div>
        {route.stops.length > 0 && (
          <div className='go__route'>
            <h2 className='fredericka go__route-head'>A morning route</h2>
            <ol className='go__stops'>
              {route.stops.map((stop, i) => (
                <li key={stop.locId}>
                  {i > 0 && (
                    <span className='go__leg' aria-label={route.drive?.legs?.[i - 1] ? `${route.drive.legs[i - 1].minutes} minute drive` : 'drive'}>
                      {route.drive?.legs?.[i - 1] ? `↓ ${route.drive.legs[i - 1].minutes} min drive · ${route.drive.legs[i - 1].miles} mi` : '↓ drive'}
                    </span>
                  )}
                  <button type='button' onClick={() => { setSelected(stop.locId); setShowRoute(true) }}>
                    <span className='go__stop-n'>{i + 1}</span>
                    <span className='go__stop-text'>
                      <strong>{stop.locName ?? stop.locId}</strong>
                      <span>{birdsWord(stop.expected)} expected{stop.bestTime ? ` · best ${stop.bestTime}` : ''}</span>
                      {stop.birds.length > 0 && <span className='go__stop-birds'>{stop.birds.slice(0, 4).map(b => `${b.comName} ${b.chance}%`).join(' · ')}{stop.birds.length > 4 ? ` · +${stop.birds.length - 4}` : ''}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className='go__covers'>
              Together these cover about {birdsWord(route.covers)} of your {species.length}.
              {route.drive ? ` ${route.drive.minutes} minutes of driving, ${route.drive.miles} miles.` : ''}
              {route.stops[0]?.bestTime ? ` Start at ${route.stops[0].locName ?? 'the first stop'}, best ${route.stops[0].bestTime}.` : ''}
            </p>
            <div className='go__route-actions'>
              <button type='button' className={`pill-button ${showRoute ? 'pill-button--primary' : ''}`} aria-pressed={showRoute} onClick={() => setShowRoute(v => !v)}>{showRoute ? 'Hide route on map' : 'Show route on map'}</button>
              {route.url && <a className='pill-button' href={route.url} target='_blank' rel='noreferrer'>Open in Maps</a>}
            </div>
          </div>
        )}
      </header>

      <div className={`go__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
        <div className='go__map'>
          {points.length
            ? <SightingsMap points={points} focus={focus} route={focus ? null : routeOnMap} height='100%' ariaLabel={`Map of places for your watch list in ${regionName}`} openHighlighted={!focus}
                onPinClick={(hit) => { const p = places.find(x => x.locId === hit[0]?.id); if (!p) return; if (openNearby && p.locId !== openNearby) closeNearby(); select(p) }} />
            : <p className='list-note go__nomap'>None of these places have coordinates yet.</p>}
        </div>
        <div className='go__list-col'>
          <div className='go__scroll'>
            <h2 className='fredericka go__subhead'>Best places for your birds</h2>
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
                  {place.isHotspot === false && place.lat !== null && (
                    <NearbyPublic placeName={place.locName ?? place.locId} open={openNearby === place.locId}
                      onOpen={() => { setOpenNearby(place.locId); setActiveNearby(null); setSelected(place.locId) }}
                      data={openNearby === place.locId ? nearby.data : undefined} isPending={openNearby === place.locId && nearby.isPending} isError={openNearby === place.locId && nearby.isError}
                      activeId={activeNearby} onPick={(id) => setActiveNearby(current => current === id ? null : id)} onClose={closeNearby} />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhereToGo
