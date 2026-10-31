import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import SeasonStrip from '../SeasonStrip/SeasonStrip'
import { SoundCredit, SoundPill } from '../SoundButton/SoundButton'
import NearbyPublic from '../NearbyPublic/NearbyPublic'
import { useBirdSound } from '../../hooks/useBirdSound'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useCurrentUser, useNearbyPublicQuery, useRegionsQuery, useSavedCodes, useSeenCodes, useSeasonalityQuery, useSavedRouteQuery, useSpeciesObservationsQuery, useWhereToFindQuery } from '../../hooks/queries'
import { focusFor } from '../../mapFocus'
import { unitFor } from '../../distance'
import { countyLabel, useLinkRegion } from '../../linkRegion'
import { useToggleSavedMutation, useToggleSeenMutation } from '../../hooks/mutations'
import { shareThing } from '../../share'
import type { Observation, Place, PersistenceClass } from '../../types'
import { formatObsDt } from '../../format'
import { article, chanceStyle } from '../../chance'
import AccuracyBadge from '../AccuracyBadge/AccuracyBadge'
import StillThere from '../StillThere/StillThere'
import AbaCode from '../AbaCode/AbaCode'
import { celebrateLifer, popStar } from '../Pop/pop'
import './Sighting.css'

const mapsHref = (o: Observation) => {
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?ll=${o.lat},${o.lng}&q=${encodeURIComponent(`${o.comName} - ${o.locName}`)}&z=15`
    : `https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}`
}

const CLASS_LABEL: Record<PersistenceClass, string> = {
  resident: 'Here all year',
  seasonal: 'A seasonal visitor here',
  passage: 'Passing through',
  rare: 'Rare here'
}

const ago = (daysAgo: number) => daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`


/** The sentence under a place: the chance and when to go (the place's own hours, else the species'). */
const chanceLine = (place: Place, speciesTime: string | null) => {
  if (place.chance === undefined) return null
  const when = place.bestTime?.label ?? speciesTime
  return `You have ${article(place.chance)} ${place.chance}% chance to see it here${when ? `, best ${when}` : ''}`
}

/** The evidence behind the number: how often, how recently, and how much the place is birded. */
const evidence = (place: Place) => {
  const parts = [`${place.days} ${place.days === 1 ? 'day' : 'days'} in 30`, `last ${ago(place.lastSeen.daysAgo)}${place.lastSeen.time ? ` ${formatObsDt(`${place.lastSeen.day} ${place.lastSeen.time}`).split(', ')[1] ?? ''}` : ''}`.trim()]
  if (place.effort.detection !== null) parts.push(`on ${place.effort.withSpecies} of ${place.effort.checklists} checklists`)
  else if (place.effort.checklists > 0) parts.push(`${place.effort.checklists} ${place.effort.checklists === 1 ? 'checklist' : 'checklists'} lately`)
  return parts.join(' · ')
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
  const distanceUnit = unitFor(user.state)
  // An alert or link for another county opens on that county.
  const { region, state, own, query } = useLinkRegion(user)
  const navigate = useNavigate()

  const birds = useBirdsQuery(code ? [code] : [])
  const bird = birds.data?.[0]
  const observations = useSpeciesObservationsQuery(region, code)
  const savedCodes = useSavedCodes()
  const toggleSaved = useToggleSavedMutation()
  const seen = useSeenCodes()
  const toggleSeen = useToggleSeenMutation()
  const seasonality = useSeasonalityQuery(region, code)
  const where = useWhereToFindQuery(region, code)
  // A rarity or a bird passing through may already have moved on, so its report gets a "still there?".
  const chaseable = where.data?.class === 'rare' || where.data?.class === 'passage'
  const start = useSavedRouteQuery(chaseable ? region : '').data?.start ?? null
  const [openNearby, setOpenNearby] = useState<string | null>(null)
  const [activeNearby, setActiveNearby] = useState<string | null>(null)
  const sound = useBirdSound(code, bird?.comName ?? code)
  const regions = useRegionsQuery(state)
  const regionName = countyLabel(regions.data?.find(r => r.code === region)?.name, state, own)

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

  const nearbyPlace = useMemo(() => (where.data?.places ?? []).find(p => p.locId === openNearby) ?? null, [where.data, openNearby])
  const nearby = useNearbyPublicQuery(nearbyPlace?.lat ?? null, nearbyPlace?.lng ?? null, Boolean(nearbyPlace))
  const focus = useMemo(() => nearbyPlace && nearbyPlace.lat !== null && nearbyPlace.lng !== null && nearby.data
    ? { ...focusFor({ lat: nearbyPlace.lat, lng: nearbyPlace.lng, label: nearbyPlace.locName ?? nearbyPlace.locId }, nearby.data, distanceUnit), activeId: activeNearby, onTargetClick: (id: string) => setActiveNearby(current => current === id ? null : id) }
    : null, [nearbyPlace, nearby.data, activeNearby, distanceUnit])
  const closeNearby = () => { setOpenNearby(null); setActiveNearby(null) }

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
  const watch = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!bird) return
    popStar(event.currentTarget, !isWatched)
    toggleSaved.mutate({ bird, save: !isWatched }, {
      onSuccess: () => toast.success(isWatched ? 'Removed from your watch list.' : 'Added to your watch list!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }
  const img = bird?.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : '/images/noBirdImg.png'
  const ebirdHref = current?.subId ? `https://ebird.org/checklist/${current.subId}` : `https://ebird.org/species/${code}`
  // Selecting swaps the report in place; the browser's Back still leaves the page, not the selection.
  const select = (o: Observation) => navigate(`/sighting/${code}/${o.subId}${query}`, { replace: true })
  // A place stands for its newest report in the live feed; selecting it pans the map there.
  const reportAt = (place: Place) => all.find(o => o.subId === place.lastSeen.subId) ?? all.find(o => o.locId === place.locId) ?? all.find(o => o.locName === place.locName)
  const places = where.data?.places ?? []
  const currentPlace = current ? (places.find(p => p.lastSeen.subId === current.subId) ?? places.find(p => p.locId === current.locId)) : undefined

  return (
    <section className='sighting'>
      <header className='sighting__hero'>
        <img className='sighting__photo' src={img} alt={`a ${name}`} />
        <div className='sighting__title'>
          <h1 className='fredericka'>{name}</h1>
          {bird?.sciName && <p className='sighting__sci'>{bird.sciName}</p>}
          {bird?.aba && bird.aba >= 3 && bird.aba <= 5 && <p className='sighting__aba'><AbaCode code={bird.aba} explain /></p>}
          <p className='sighting__blurb'>
            {all.length ? `Reported ${all.length === 1 ? 'once' : `${all.length} times`} in ${regionName} in the last 30 days.` : `No reports in ${regionName} in the last 30 days.`}
          </p>
          {/* The recording's credit, which its license asks for, above the buttons so the row never moves. */}
          {(sound.state === 'playing' || sound.state === 'paused') && <p className='sighting__credit'><SoundCredit sound={sound.sound} /></p>}
          <div className='sighting__actions'>
            {bird && <SoundPill state={sound.state} name={name} onToggle={() => { void sound.toggle() }} />}
            {bird && <button type='button' className='pill-button' onClick={watch} disabled={toggleSaved.isPending} aria-pressed={isWatched}>{isWatched ? '★ On your watch list' : '☆ Add to watch list'}</button>}
            {bird && current && <button type='button' className='pill-button' onClick={() => {
              void shareThing({ kind: 'sighting', speciesCode: bird.speciesCode, locId: current.locId, locName: current.locName, lat: current.lat, lng: current.lng, obsDt: current.obsDt, howMany: current.howMany ?? null, subId: current.subId, regionName }, `${bird.comName} at ${current.locName}`)
            }}>Share</button>}
            {bird && (() => {
              const isSeen = seen.codes.has(bird.speciesCode)
              return <button type='button' className={`pill-button ${isSeen ? 'pill-button--seen' : ''}`} disabled={!seen.loaded} aria-pressed={isSeen}
                onClick={(event) => {
                  // Going on the life list is celebrated at the tap; coming off is said once it's done.
                  if (!isSeen) celebrateLifer(event.currentTarget, bird.comName)
                  toggleSeen.mutate({ speciesCode: bird.speciesCode, seen: !isSeen }, {
                    onSuccess: () => { if (isSeen) toast.success('Removed from your life list.', { position: 'bottom-center' }) },
                    onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
                  })
                }}>{isSeen ? '✓ On your life list' : 'Seen it?'}</button>
            })()}
            {bird?.wikiURL && <a className='pill-button' href={bird.wikiURL} target='_blank' rel='noreferrer'>Wikipedia</a>}
          </div>
        </div>
        {seasonality.data?.months && (
          <div className='sighting__season'>
            <h2 className='fredericka sighting__season-head'>When {name} is around</h2>
            <SeasonStrip months={seasonality.data.months} name={name} regionName={regionName} />
          </div>
        )}
        {bird?.tips && (
          <div className='sighting__tips'>
            <h2 className='fredericka sighting__season-head'>Where to look</h2>
            <dl className='sighting__tips-list'>
              <div><dt>Habitat</dt><dd>{bird.tips.habitat}</dd></div>
              <div><dt>How to find it</dt><dd>{bird.tips.look}</dd></div>
              <div><dt>Best time</dt><dd>{bird.tips.time}</dd></div>
            </dl>
          </div>
        )}
      </header>

      <div className={`sighting__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
        <div className='sighting__map'>
          {all.length
            ? <SightingsMap points={points} focus={focus} height='100%' ariaLabel={`Map of recent ${name} sightings in your region`} openHighlighted={!focus}
                onPinClick={(hit) => { const o = all.find(x => `${x.subId}-${x.lat}-${x.lng}` === hit[0]?.id); if (!o) return; if (openNearby && !(nearbyPlace && (o.subId === nearbyPlace.lastSeen.subId || o.locId === nearbyPlace.locId))) closeNearby(); select(o) }} />
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
            {chaseable && current?.locId && <StillThere key={`${current.locId}-${code}`} locId={current.locId} code={code} cls={where.data?.class} to={current} from={start}
              placeChance={currentPlace?.chance} />}
            {where.data && places.length > 0 ? (
              <>
                <h2 className='fredericka sighting__subhead'>
                  Where to find it
                  <span className='sighting__count'>{places.length}</span>
                </h2>
                <p className='sighting__odds'>
                  <span>{CLASS_LABEL[where.data.class]}</span>
                  <span>{where.data.bestTime.source === 'reports' ? `Best ${where.data.bestTime.label}` : `Usually best: ${where.data.bestTime.label.toLowerCase()}`}</span>
                </p>
                {/* Best hotspots ranks one's own county, so the link only shows there. */}
                {own && <p className='sighting__best-link'><Link to={`/go?tab=best&species=${encodeURIComponent(code)}&days=90`}>Best hotspots for {name} →</Link></p>}
                <AccuracyBadge grades={where.data.grades} />
                <ol className='sighting__list sighting__places'>
                  {places.map(place => {
                    const selected = currentPlace?.locId === place.locId
                    const report = reportAt(place)
                    const note = place.notes[0]
                    return (
                      <li key={place.locId} className={selected ? 'is-current' : undefined}>
                        <button type='button' onClick={() => { if (report) select(report) }} aria-current={selected ? 'true' : undefined} disabled={!report}>
                          <span className='place__head'>
                            <span className={`band band--${place.band.toLowerCase().replace(' ', '-')}`} style={chanceStyle(place.chance)}>{place.band}</span>
                            <strong>{place.locName ?? place.locId}</strong>
                            {place.isHotspot === false && <span className='place__private' title='A personal location, not a public hotspot'>private</span>}
                            {(place.merged?.length ?? 0) > 0 && <span className='place__private' title={`Includes nearby personal locations: ${place.merged!.map(m => m.locName ?? m.locId).join(', ')}`}>+{place.merged!.length} nearby</span>}
                          </span>
                          {chanceLine(place, where.data.bestTime.source === 'reports' ? where.data.bestTime.label : null) && <span className='place__chance'>{chanceLine(place, where.data.bestTime.source === 'reports' ? where.data.bestTime.label : null)}</span>}
                          <span className='place__evidence'>{evidence(place)}</span>
                          {note && <span className='place__note'>“{note.text}”{note.observer ? ` — ${note.observer}` : ''}, {formatObsDt(note.time ? `${note.day} ${note.time}` : note.day)}</span>}
                        </button>
                        {place.isHotspot === false && place.lat !== null && (
                          <NearbyPublic placeName={place.locName ?? place.locId} open={openNearby === place.locId}
                            onOpen={() => { setOpenNearby(place.locId); setActiveNearby(null); const r = reportAt(place); if (r) select(r) }}
                            data={openNearby === place.locId ? nearby.data : undefined} isPending={openNearby === place.locId && nearby.isPending} isError={openNearby === place.locId && nearby.isError}
                      activeId={activeNearby} onPick={(id) => setActiveNearby(current => current === id ? null : id)} onClose={closeNearby} />
                        )}
                      </li>
                    )
                  })}
                </ol>
              </>
            ) : (
              <>
                <h2 className='fredericka sighting__subhead'>
                  Reported in the last 30 days
                  <span className='sighting__count'>{all.length}</span>
                </h2>
                {where.isPending && <p className='list-note'>Working out where to look…</p>}
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Sighting
