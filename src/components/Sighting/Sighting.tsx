import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'react-toastify'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import SeasonStrip from '../SeasonStrip/SeasonStrip'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBirdsQuery, useCurrentUser, useRegionsQuery, useSavedCodes, useSeasonalityQuery, useSpeciesObservationsQuery } from '../../hooks/queries'
import { useToggleSavedMutation } from '../../hooks/mutations'
import type { Observation } from '../../types'
import './Sighting.css'

const formatObsDt = (obsDt: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(obsDt)
  if (!m) return obsDt
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0))
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return m[4] ? `${day}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : day
}

const mapsHref = (o: Observation) => {
  const apple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?ll=${o.lat},${o.lng}&q=${encodeURIComponent(`${o.comName} - ${o.locName}`)}&z=15`
    : `https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}`
}

/** One sighting in full: the bird, where and when, every recent location of the species, links out. */
const Sighting = () => {
  const { code = '', subId = '' } = useParams<{ code: string; subId: string }>()
  const user = useCurrentUser()
  const region = user.location

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
    href: `/sighting/${code}/${o.subId}`,
    highlight: current ? o.subId === current.subId && o.lat === current.lat && o.lng === current.lng : false
  })), [all, current, code])

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

  return (
    <section className='sighting'>
      <p className='sighting__crumbs'><Link to='/'>Home</Link> · <Link to='/map'>Region map</Link></p>
      <header className='sighting__hero'>
        <img className='sighting__photo' src={img} alt={`a ${name}`} />
        <div className='sighting__title'>
          <h1 className='fredericka'>{name}</h1>
          {bird?.sciName && <p className='sighting__sci'>{bird.sciName}</p>}
          {current
            ? <p className='sighting__meta'>
                <strong>{current.locName}</strong><br />
                {formatObsDt(current.obsDt)}{current.howMany ? ` · ${current.howMany} seen` : ''}
              </p>
            : <p className='sighting__meta'>This report is older than 30 days, so its details are no longer in eBird's recent feed.</p>}
          <div className='sighting__actions'>
            {current && <a className='pill-button pill-button--primary' href={mapsHref(current)} target='_blank' rel='noreferrer'>Open in Maps</a>}
            <a className='pill-button' href={ebirdHref} target='_blank' rel='noreferrer'>View on eBird</a>
            {bird && <button type='button' className='pill-button' onClick={watch} disabled={toggleSaved.isPending}>{isWatched ? '★ On your watch list' : '☆ Add to watch list'}</button>}
            {bird?.wikiURL && <a className='pill-button' href={bird.wikiURL} target='_blank' rel='noreferrer'>Wikipedia</a>}
          </div>
        </div>
      </header>

      {seasonality.data?.months && (
        <>
          <h2 className='fredericka sighting__subhead'>When {name} is around</h2>
          <SeasonStrip months={seasonality.data.months} name={name} regionName={regionName} />
        </>
      )}

      <h2 className='fredericka sighting__subhead'>
        Where {name} has been reported in the last 30 days
        <span className='sighting__count'>{all.length}</span>
      </h2>
      {all.length
        ? <SightingsMap points={points} height='min(60vh, 460px)' ariaLabel={`Map of recent ${name} sightings in your region`} />
        : <p className='list-note'>No reports of this species in your region in the last 30 days.</p>}

      {all.length > 1 && (
        <ol className='sighting__list'>
          {all.map(o => (
            <li key={`${o.subId}-${o.lat}-${o.lng}`} className={current && o.subId === current.subId ? 'is-current' : undefined}>
              <Link to={`/sighting/${code}/${o.subId}`}>
                <strong>{o.locName}</strong>
                <span>{formatObsDt(o.obsDt)}{o.howMany ? ` · ${o.howMany} seen` : ''}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default Sighting
