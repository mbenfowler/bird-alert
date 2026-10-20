import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { AlertIcon, StarIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useNotableQuery, useObservationsQuery, useRegionsQuery, useSavedCodes, useSpeciesObservationsQuery } from '../../hooks/queries'
import type { Observation } from '../../types'
import './MapPage.css'

type Feed = 'watchlist' | 'notable'

const toPoints = (observations: Observation[]): MapPoint[] => {
  const seen = new Set<string>()
  const points: MapPoint[] = []
  for (const o of observations) {
    const id = `${o.speciesCode}-${o.subId}-${o.lat}-${o.lng}`
    if (seen.has(id)) continue
    seen.add(id)
    points.push({ id, lat: o.lat, lng: o.lng, title: o.comName, subtitle: `${o.locName} · ${o.obsDt}`, href: `/sighting/${o.speciesCode}/${o.subId}` })
  }
  return points
}

/** Every recent sighting in the region on one map: watch-list birds, notable birds, or one species. */
const MapPage = () => {
  const user = useCurrentUser()
  const region = user.location
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const [feed, setFeed] = useState<Feed>('watchlist')

  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? region

  const observations = useObservationsQuery(region)
  const notable = useNotableQuery(region, feed === 'notable' && !code)
  const species = useSpeciesObservationsQuery(region, code)
  const savedCodes = useSavedCodes()

  const shown = useMemo(() => {
    if (code) return species.data ?? []
    if (feed === 'notable') return notable.data ?? []
    return (observations.data ?? []).filter(o => savedCodes.has(o.speciesCode))
  }, [code, feed, species.data, notable.data, observations.data, savedCodes])
  const points = useMemo(() => toPoints(shown), [shown])
  const active = code ? species : feed === 'notable' ? notable : observations
  const speciesName = shown[0]?.comName

  return (
    <section className='map-page'>
      <header className='map-page__bar'>
        <h1 className='fredericka'>{code ? `${speciesName ?? code} in ${regionName}` : `Recent sightings in ${regionName}`}</h1>
        {code
          ? <Link className='pill-button' to='/map'>All sightings</Link>
          : <div className='map-page__tabs' role='group' aria-label='Which sightings to show'>
              <button type='button' className={`alert-icon ${feed === 'watchlist' ? 'button-pressed' : ''}`} aria-pressed={feed === 'watchlist'} aria-label='Watch list sightings' title='Watch list' onClick={() => setFeed('watchlist')}><StarIcon /></button>
              <button type='button' className={`alert-icon ${feed === 'notable' ? 'button-pressed' : ''}`} aria-pressed={feed === 'notable'} aria-label='Notable sightings' title='Notable' onClick={() => setFeed('notable')}><AlertIcon /></button>
            </div>}
      </header>
      {active.isError && <ErrorMessage networkError={errorMessage(active.error)} />}
      {active.isPending && <LoadingState label='Loading sightings…' />}
      {!active.isPending && !active.isError && (
        <>
          <p className='list-note'>
            {points.length
              ? `${points.length} sighting${points.length === 1 ? '' : 's'} on the map. Tap a pin for details.`
              : code ? 'No reports of this species in the last 30 days.' : feed === 'notable' ? 'No notable sightings reported in the last month.' : 'No watch-list birds reported in the last two weeks.'}
          </p>
          <SightingsMap points={points} height='min(70vh, 620px)' ariaLabel={`Map of recent sightings in ${regionName}`} />
        </>
      )}
    </section>
  )
}

export default MapPage
