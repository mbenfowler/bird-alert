import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { formatObsDt } from '../../format'
import { parseSightingRefs, useCurrentUser, useRegionsQuery, useSightingsQuery } from '../../hooks/queries'
import './AlertSightings.css'

/**
 * Where a watch-list push notification lands: every sighting it announced on one small map, with
 * a table of the details beneath. The link carries the species and checklist ids (?s=code:subId,…).
 */
const AlertSightings = () => {
  const user = useCurrentUser()
  const region = user.location
  const [params] = useSearchParams()
  const refs = useMemo(() => parseSightingRefs(params.get('s')), [params])
  const sightings = useSightingsQuery(region, refs)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? 'your county'

  const rows = useMemo(() => sightings.data ?? [], [sightings.data])
  const points = useMemo<MapPoint[]>(() => rows.map(o => ({
    id: `${o.speciesCode}-${o.subId}-${o.lat}-${o.lng}`,
    lat: o.lat,
    lng: o.lng,
    title: o.comName,
    subtitle: `${o.locName} · ${formatObsDt(o.obsDt)}`,
    href: `/sighting/${o.speciesCode}/${o.subId}`
  })), [rows])
  const missing = refs.length - new Set(rows.map(o => o.speciesCode)).size

  return (
    <section className='alert-sightings'>
      <p className='alert-sightings__crumbs'><Link to='/'>Home</Link> · <Link to='/map'>Region map</Link></p>
      <h1 className='fredericka'>Watch list sightings</h1>
      {!refs.length && <p className='list-note'>This link did not name any sightings. <Link to='/'>See today's alerts on the home page.</Link></p>}
      {sightings.isError && <ErrorMessage networkError={errorMessage(sightings.error)} />}
      {sightings.isPending && refs.length > 0 && <LoadingState label='Loading sightings…' />}
      {sightings.isSuccess && (
        <>
          <p className='list-note'>
            {rows.length
              ? `${rows.length} bird${rows.length === 1 ? '' : 's'} from your watch list reported in ${regionName}. Tap a pin or a row for the full sighting.`
              : 'None of these reports are in eBird\'s recent feed any more.'}
            {missing > 0 && rows.length > 0 ? ` ${missing} ${missing === 1 ? 'is' : 'are'} no longer in the feed.` : ''}
          </p>
          {rows.length > 0 && (
            <>
              <SightingsMap points={points} height='min(45vh, 340px)' ariaLabel={`Map of these watch list sightings in ${regionName}`} />
              <table className='alert-sightings__table'>
                <thead>
                  <tr><th scope='col'>Bird</th><th scope='col'>When</th><th scope='col'>Seen</th></tr>
                </thead>
                <tbody>
                  {rows.map(o => (
                    <tr key={`${o.speciesCode}-${o.subId}-${o.lat}-${o.lng}`}>
                      <td>
                        <Link to={`/sighting/${o.speciesCode}/${o.subId}`}>{o.comName}</Link>
                        <span className='alert-sightings__where'>{o.locName}</span>
                      </td>
                      <td>{formatObsDt(o.obsDt)}</td>
                      <td>{o.howMany ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  )
}

export default AlertSightings
