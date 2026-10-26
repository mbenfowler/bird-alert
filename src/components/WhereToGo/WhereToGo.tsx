import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useRegionsQuery, useSavedCodes, useWhereToGoQuery } from '../../hooks/queries'
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
  const codes = useMemo(() => [...savedCodes].sort(), [savedCodes])
  const go = useWhereToGoQuery(region, codes)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? 'your county'
  const [selected, setSelected] = useState<string | null>(null)

  const places = useMemo(() => go.data?.places ?? [], [go.data])
  const points = useMemo<MapPoint[]>(() => places.filter(p => p.lat !== null && p.lng !== null).map(p => ({
    id: p.locId,
    lat: p.lat!,
    lng: p.lng!,
    title: p.locName ?? p.locId,
    subtitle: `${birdsWord(p.expected)} expected${p.bestTime ? ` · best ${p.bestTime}` : ''}`,
    highlight: p.locId === selected
  })), [places, selected])

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
                  <button type='button' onClick={() => setSelected(stop.locId)}>
                    <span className='go__stop-n'>{i + 1}</span>
                    <span className='go__stop-text'>
                      <strong>{stop.locName ?? stop.locId}</strong>
                      <span>{birdsWord(stop.expected)} expected{stop.bestTime ? ` · best ${stop.bestTime}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className='go__covers'>Together these cover about {birdsWord(route.covers)} of your {species.length}.</p>
            {route.url && <a className='pill-button pill-button--primary' href={route.url} target='_blank' rel='noreferrer'>Open route in Maps</a>}
          </div>
        )}
      </header>

      <div className={`go__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
        <div className='go__map'>
          {points.length
            ? <SightingsMap points={points} height='100%' ariaLabel={`Map of places for your watch list in ${regionName}`} openHighlighted
                onPinClick={(hit) => { const p = places.find(x => x.locId === hit[0]?.id); if (p) select(p) }} />
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
