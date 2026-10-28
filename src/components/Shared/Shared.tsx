import { useMemo, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import SightingsMap from '../SightingsMap/SightingsMap'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useSessionQuery, useShareQuery } from '../../hooks/queries'
import { mapsUrl } from '../../routePlan'
import { formatObsDt } from '../../format'
import type { SharedRoute, SharedSighting } from '../../types'
import './Shared.css'

/** The invitation under a shared page, for someone who doesn't have the app yet. */
const Invite = ({ what }: { what: string }) => {
  const session = useSessionQuery()
  if (session.data) return <p className='shared__back'><Link to='/'>Back to your birds</Link></p>
  return (
    <aside className='shared__invite'>
      <p><strong>Bird Alert!</strong> finds {what} near you: live sightings, your chances at each spot, and alerts the moment a bird you want is reported. Free.</p>
      <Link className='pill-button pill-button--primary' to='/login'>Start free</Link>
    </aside>
  )
}

const RouteView = ({ share }: { share: SharedRoute }) => {
  const stops = share.stops
  const path = share.drive?.geometry?.length ? share.drive.geometry : stops.map(s => [s.lat, s.lng] as [number, number])
  const points = useMemo(() => stops.map((s, i) => ({ id: `stop-${i}`, lat: s.lat, lng: s.lng, title: `${i + 1}. ${s.name}`, subtitle: s.detail ?? undefined })), [stops])
  const url = mapsUrl(stops.map(s => ({ locId: s.locId, name: s.name, lat: s.lat, lng: s.lng })))
  return (
    <article className='shared'>
      <p className='shared__kicker'>A shared birding route</p>
      <h1 className='fredericka shared__title'>{share.title ?? `A morning route${share.regionName ? ` in ${share.regionName}` : ''}`}</h1>
      <p className='shared__lede'>
        {stops.length} {stops.length === 1 ? 'stop' : 'stops'}{share.drive?.minutes ? ` · ${share.drive.minutes} minutes of driving, ${share.drive.miles} miles` : ''}.{share.covers ? ` ${share.covers}` : ''}
      </p>
      <div className='shared__grid'>
        <ol className='shared__stops'>
          {stops.map((s, i) => (
            <li key={`${s.lat},${s.lng}`}>
              {i > 0 && <span className='shared__leg'>↓ {share.drive?.legs?.[i - 1] ? `${share.drive.legs[i - 1]!.minutes} min drive · ${share.drive.legs[i - 1]!.miles} mi` : 'drive'}</span>}
              <div className='shared__stop'>
                <span className='shared__n'>{i + 1}</span>
                <span>
                  <strong>{s.name}</strong>
                  {s.detail && <span className='shared__detail'>{s.detail}</span>}
                  {s.birds.length > 0 && <span className='shared__birds'>{s.birds.join(' · ')}</span>}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <div className='shared__map'>
          <SightingsMap points={points} route={stops.length > 1 ? { path, stops: stops.map(s => ({ lat: s.lat, lng: s.lng, label: s.name })) } : null} height='100%' ariaLabel='Map of the route' />
        </div>
      </div>
      {url && <p className='shared__actions'><a className='pill-button pill-button--primary' href={url} target='_blank' rel='noreferrer'>Open the route in Maps</a></p>}
      <Invite what='routes like this' />
    </article>
  )
}

const SightingView = ({ share }: { share: SharedSighting }) => {
  const points = useMemo(() => [{ id: 'here', lat: share.lat, lng: share.lng, title: share.locName, highlight: true }], [share])
  const maps = `https://www.google.com/maps/search/?api=1&query=${share.lat}%2C${share.lng}`
  return (
    <article className='shared'>
      <p className='shared__kicker'>A shared sighting</p>
      <div className='shared__bird'>
        {/* The whole bird, however tall the photo: it sits uncropped over a blurred copy of itself. */}
        {share.birdImg && (
          <div className='shared__photo' style={{ '--photo': `url("${share.birdImg.replace(/"/g, '%22')}")` } as CSSProperties}>
            <img src={share.birdImg} alt={`A ${share.comName}`} width='320' height='240' />
          </div>
        )}
        <div>
          <h1 className='fredericka shared__title'>{share.comName}</h1>
          {share.sciName && <p className='shared__sci'>{share.sciName}</p>}
          <p className='shared__lede'>
            {share.howMany && share.howMany > 1 ? `${share.howMany} reported` : 'Reported'} at <strong>{share.locName}</strong>
            {share.obsDt ? `, ${formatObsDt(share.obsDt)}` : ''}{share.regionName ? ` (${share.regionName})` : ''}.
          </p>
          <p className='shared__actions'>
            <a className='pill-button pill-button--primary' href={maps} target='_blank' rel='noreferrer'>Directions</a>
            {share.subId && <a className='pill-button' href={`https://ebird.org/checklist/${encodeURIComponent(share.subId)}`} target='_blank' rel='noreferrer'>The checklist on eBird</a>}
          </p>
        </div>
      </div>
      <div className='shared__map shared__map--single'>
        <SightingsMap points={points} height='100%' ariaLabel={`Map of where the ${share.comName} was reported`} />
      </div>
      <Invite what={`birds like the ${share.comName}`} />
    </article>
  )
}

/** /share/r/:id and /share/s/:id: a route or a sighting someone sent, readable without an account. */
const Shared = () => {
  const { id = '' } = useParams()
  const share = useShareQuery(id)
  if (share.isPending) return <LoadingState label='Opening the shared link…' />
  if (share.isError) {
    return (
      <article className='shared'>
        <h1 className='fredericka shared__title'>This link didn’t open</h1>
        <p className='shared__lede'>{errorMessage(share.error)}</p>
        <Invite what='birds' />
      </article>
    )
  }
  return share.data.kind === 'route' ? <RouteView share={share.data} /> : <SightingView share={share.data} />
}

export default Shared
