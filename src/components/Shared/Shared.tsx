import { useMemo, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import SightingsMap from '../SightingsMap/SightingsMap'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useSessionQuery, useShareQuery } from '../../hooks/queries'
import { mapsUrl } from '../../routePlan'
import { formatObsDt } from '../../format'
import StillThere from '../StillThere/StillThere'
import AbaCode from '../AbaCode/AbaCode'
import type { SharedRoute, SharedSighting } from '../../types'
import { longDistance, shortDistance, useDistanceUnit } from '../../distance'
import './Shared.css'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

/** The invitation under a shared page, for someone who doesn't have the app yet. */
const Invite = ({ what }: { what: string }) => {
  const session = useSessionQuery()
  if (session.data) return <p className='shared__back'><Link to='/'>{t('shared.back')}</Link></p>
  return (
    <aside className='shared__invite'>
      <p><Trans i18nKey='shared.invite' values={{ what }} components={{ b: <strong /> }} /></p>
      <Link className='pill-button pill-button--primary' to='/login'>{t('landing.start')}</Link>
    </aside>
  )
}

const RouteView = ({ share }: { share: SharedRoute }) => {
  const stops = share.stops
  const unit = useDistanceUnit()
  const path = share.drive?.geometry?.length ? share.drive.geometry : stops.map(s => [s.lat, s.lng] as [number, number])
  const points = useMemo(() => stops.map((s, i) => ({ id: `stop-${i}`, lat: s.lat, lng: s.lng, title: `${i + 1}. ${s.name}`, subtitle: s.detail ?? undefined })), [stops])
  const url = mapsUrl(stops.map(s => ({ locId: s.locId, name: s.name, lat: s.lat, lng: s.lng })))
  return (
    <article className='shared'>
      <p className='shared__kicker'>{t('shared.routeKicker')}</p>
      <h1 className='fredericka shared__title'>{share.title ?? (share.regionName ? t('shared.routeIn', { regionName: share.regionName }) : t('route.suggested'))}</h1>
      <p className='shared__lede'>
        {share.drive?.minutes ? t('shared.stopsDrive', { count: stops.length, minutes: share.drive.minutes, distance: longDistance(share.drive.miles, unit) }) : t('shared.stops', { count: stops.length })}{share.covers ? ` ${share.covers}` : ''}
      </p>
      <div className='shared__grid'>
        <ol className='shared__stops'>
          {stops.map((s, i) => (
            <li key={`${s.lat},${s.lng}`}>
              {i > 0 && <span className='shared__leg'>{share.drive?.legs?.[i - 1] ? t('route.leg', { minutes: share.drive.legs[i - 1]!.minutes, distance: shortDistance(share.drive.legs[i - 1]!.miles, unit) }) : t('route.legUnknown')}</span>}
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
          <SightingsMap points={points} route={stops.length > 1 ? { path, stops: stops.map(s => ({ lat: s.lat, lng: s.lng, label: s.name })) } : null} height='100%' ariaLabel={t('shared.routeMap')} />
        </div>
      </div>
      {url && <p className='shared__actions'><a className='pill-button pill-button--primary' href={url} target='_blank' rel='noreferrer'>{t('shared.openRoute')}</a></p>}
      <Invite what={t('shared.whatRoutes')} />
    </article>
  )
}

const SightingView = ({ share }: { share: SharedSighting }) => {
  const points = useMemo(() => [{ id: 'here', lat: share.lat, lng: share.lng, title: share.locName, highlight: true }], [share])
  const maps = `https://www.google.com/maps/search/?api=1&query=${share.lat}%2C${share.lng}`
  return (
    <article className='shared'>
      <p className='shared__kicker'>{t('shared.sightingKicker')}</p>
      <div className='shared__bird'>
        {/* The whole bird, however tall the photo: it sits uncropped over a blurred copy of itself. */}
        {share.birdImg && (
          <div className='shared__photo' style={{ '--photo': `url("${share.birdImg.replace(/"/g, '%22')}")` } as CSSProperties}>
            <img src={share.birdImg} alt={t('shared.photoAlt', { name: share.comName })} width='320' height='240' />
          </div>
        )}
        <div>
          <h1 className='fredericka shared__title'>{share.comName}</h1>
          {share.sciName && <p className='shared__sci'>{share.sciName}</p>}
          {share.aba && share.aba >= 3 && share.aba <= 5 && <p className='shared__aba'><AbaCode code={share.aba} explain /></p>}
          <p className='shared__lede'>
            <Trans i18nKey={share.howMany && share.howMany > 1 ? 'shared.reportedMany' : 'shared.reported'} values={{ count: share.howMany ?? 1, place: share.locName }} components={{ b: <strong /> }} />
            {share.obsDt ? `, ${formatObsDt(share.obsDt)}` : ''}{share.regionName ? ` (${share.regionName})` : ''}.
          </p>
          <p className='shared__actions'>
            <a className='pill-button pill-button--primary' href={maps} target='_blank' rel='noreferrer'>{t('shared.directions')}</a>
            {share.subId && <a className='pill-button' href={`https://ebird.org/checklist/${encodeURIComponent(share.subId)}`} target='_blank' rel='noreferrer'>{t('shared.checklist')}</a>}
          </p>
        </div>
      </div>
      {share.locId && <StillThere locId={share.locId} code={share.speciesCode} to={share} />}
      <div className='shared__map shared__map--single'>
        <SightingsMap points={points} height='100%' ariaLabel={t('shared.sightingMap', { name: share.comName })} />
      </div>
      <Invite what={t('shared.whatBirdsLike', { name: share.comName })} />
    </article>
  )
}

/** /share/r/:id and /share/s/:id: a route or a sighting someone sent, readable without an account. */
const Shared = () => {
  const { id = '' } = useParams()
  const share = useShareQuery(id)
  if (share.isPending) return <LoadingState label={t('shared.opening')} />
  if (share.isError) {
    return (
      <article className='shared'>
        <h1 className='fredericka shared__title'>{t('shared.failed')}</h1>
        <p className='shared__lede'>{errorMessage(share.error)}</p>
        <Invite what={t('shared.whatBirds')} />
      </article>
    )
  }
  return share.data.kind === 'route' ? <RouteView share={share.data} /> : <SightingView share={share.data} />
}

export default Shared
