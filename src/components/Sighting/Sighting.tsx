import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import SeasonStrip from '../SeasonStrip/SeasonStrip'
import SoundButton from '../SoundButton/SoundButton'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useCurrentUser, useRegionsQuery, useSavedCodes, useSeasonalityQuery, useSpeciesObservationsQuery } from '../../hooks/queries'
import { useToggleSavedMutation } from '../../hooks/mutations'
import type { Observation } from '../../types'
import { formatObsDt } from '../../format'
import './Sighting.css'

const mapsHref = (o: Observation) => {
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?ll=${o.lat},${o.lng}&q=${encodeURIComponent(`${o.comName} - ${o.locName}`)}&z=15`
    : `https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}`
}

/**
 * One species. The bird card leads; below it, a frame exactly one screen tall holds the map of
 * every report in the last 30 days, the chosen one described beneath it, and the list of those
 * reports. Scrolling the page past the card docks the frame under the bar; from then on the list
 * scrolls by itself, and pulling down at its top brings the card back. Choosing from the list or
 * the map swaps the selection in place. Portrait phones stack map over list; wider screens put
 * the list beside the map.
 */
const Sighting = () => {
  const { code = '', subId = '' } = useParams<{ code: string; subId: string }>()
  const user = useCurrentUser()
  const region = user.location
  const navigate = useNavigate()

  const birds = useBirdsQuery(code ? [code] : [])
  const bird = birds.data?.[0]
  const observations = useSpeciesObservationsQuery(region, code)
  const savedCodes = useSavedCodes()
  const toggleSaved = useToggleSavedMutation()
  const seasonality = useSeasonalityQuery(region, code)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? 'your county'

  const all = useMemo(() => observations.data ?? [], [observations.data])
  const current = useMemo(() => all.find(o => o.subId === subId) ?? all[0], [all, subId])
  const points = useMemo<MapPoint[]>(() => all.map(o => ({
    id: `${o.subId}-${o.lat}-${o.lng}`,
    lat: o.lat,
    lng: o.lng,
    title: o.locName,
    subtitle: `${formatObsDt(o.obsDt)}${o.howMany ? ` · ${o.howMany} seen` : ''}`,
    // No Details link in the popup: the chosen report is already described under the map.
    highlight: current ? o.subId === current.subId && o.lat === current.lat && o.lng === current.lng : false
  })), [all, current])

  // The frame is docked once the page has scrolled it up under the bar. Until then the list does
  // not scroll on its own, so a swipe on it moves the page (and docks the frame) rather than the
  // list; once docked, the list scrolls, and at its top a pull chains back to the page.
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
  }, [all.length])

  // The list is its own scroller; a fade at its foot says there is more below (iOS hides scrollbars).
  const listRef = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const update = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    return () => { el.removeEventListener('scroll', update); observer?.disconnect() }
  }, [all.length, seasonality.data])

  if (observations.isError) return <ErrorMessage networkError={errorMessage(observations.error)} />
  if (observations.isPending || birds.isPending) return <LoadingState label='Loading sighting…' />

  const name = bird?.comName ?? current?.comName ?? code
  const isWatched = savedCodes.has(code)
  const watch = () => {
    if (!bird) return
    toggleSaved.mutate({ bird, save: !isWatched }, {
      onSuccess: () => toast.success(isWatched ? 'Removed from your watch list.' : 'Added to your watch list!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }
  const img = bird?.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : '/images/noBirdImg.png'
  const ebirdHref = current?.subId ? `https://ebird.org/checklist/${current.subId}` : `https://ebird.org/species/${code}`
  // Selecting swaps the report in place; the browser's Back still leaves the page, not the selection.
  const select = (o: Observation) => navigate(`/sighting/${code}/${o.subId}`, { replace: true })

  return (
    <section className='sighting'>
      <p className='sighting__crumbs'><Link to='/'>Home</Link> · <Link to='/map'>Region map</Link></p>
      <header className='sighting__hero'>
        <img className='sighting__photo' src={img} alt={`a ${name}`} />
        <div className='sighting__title'>
          <h1 className='fredericka'>{name}</h1>
          {bird?.sciName && <p className='sighting__sci'>{bird.sciName}</p>}
          <p className='sighting__blurb'>
            {all.length ? `Reported ${all.length === 1 ? 'once' : `${all.length} times`} in ${regionName} in the last 30 days.` : `No reports in ${regionName} in the last 30 days.`}
          </p>
          <div className='sighting__actions'>
            {bird && <SoundButton code={code} name={name} />}
            {bird && <button type='button' className='pill-button' onClick={watch} disabled={toggleSaved.isPending} aria-pressed={isWatched}>{isWatched ? '★ On your watch list' : '☆ Add to watch list'}</button>}
            {bird?.wikiURL && <a className='pill-button' href={bird.wikiURL} target='_blank' rel='noreferrer'>Wikipedia</a>}
          </div>
        </div>
        {seasonality.data?.months && (
          <div className='sighting__season'>
            <h2 className='fredericka sighting__season-head'>When {name} is around</h2>
            <SeasonStrip months={seasonality.data.months} name={name} regionName={regionName} />
          </div>
        )}
      </header>

      <div className={`sighting__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
        <div className='sighting__map'>
          {all.length
            ? <SightingsMap points={points} height='100%' ariaLabel={`Map of recent ${name} sightings in your region`} openHighlighted
                onPinClick={(hit) => { const o = all.find(x => `${x.subId}-${x.lat}-${x.lng}` === hit[0]?.id); if (o) select(o) }} />
            : <p className='list-note sighting__nomap'>No reports of this species in your region in the last 30 days.</p>}
          <div className='sighting__pick'>
            {current
              ? <p className='sighting__meta'>
                  <strong>{current.locName}</strong>
                  <span>{formatObsDt(current.obsDt)}{current.howMany ? ` · ${current.howMany} seen` : ''}</span>
                </p>
              : <p className='sighting__meta'><span>This report is older than 30 days, so its details are no longer in eBird's recent feed.</span></p>}
            <div className='sighting__actions'>
              {current && <a className='pill-button pill-button--primary pill-button--small' href={mapsHref(current)} target='_blank' rel='noreferrer'>Open in Maps</a>}
              <a className='pill-button pill-button--small' href={ebirdHref} target='_blank' rel='noreferrer'>View on eBird</a>
            </div>
          </div>
        </div>

        <div className={`sighting__list-col ${more ? 'has-more' : ''}`}>
          <div className='sighting__scroll' ref={listRef}>
            <h2 className='fredericka sighting__subhead'>
              Reported in the last 30 days
              <span className='sighting__count'>{all.length}</span>
            </h2>
            {all.length > 0 && (
              <ol className='sighting__list'>
                {all.map(o => {
                  const selected = Boolean(current && o.subId === current.subId)
                  return (
                    <li key={`${o.subId}-${o.lat}-${o.lng}`} className={selected ? 'is-current' : undefined}>
                      <button type='button' onClick={() => select(o)} aria-current={selected ? 'true' : undefined}>
                        <strong>{o.locName}</strong>
                        <span>{formatObsDt(o.obsDt)}{o.howMany ? ` · ${o.howMany} seen` : ''}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Sighting
