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
import { t } from '../../i18n'

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
        <h1 className='fredericka'>
          {code ? t('mapPage.species', { name: speciesName ?? code, regionName }) : feed === 'watchlist' ? t('mapPage.watch', { regionName }) : t('mapPage.notable', { regionName })}
        </h1>
        {code
          ? <Link className='pill-button' to='/map'>{t('mapPage.all')}</Link>
          : <div className='map-page__tabs' role='group' aria-label={t('mapPage.which')}>
              <button type='button' className={`alert-icon ${feed === 'watchlist' ? 'button-pressed' : ''}`} aria-pressed={feed === 'watchlist'} aria-label={t('alerts.watchLabel')} title={t('alerts.watchTitle')} onClick={() => setFeed('watchlist')}><StarIcon /></button>
              <button type='button' className={`alert-icon ${feed === 'notable' ? 'button-pressed' : ''}`} aria-pressed={feed === 'notable'} aria-label={t('mapPage.notableLabel')} title={t('mapPage.notableTitle')} onClick={() => setFeed('notable')}><AlertIcon /></button>
            </div>}
      </header>
      {active.isError && <ErrorMessage networkError={errorMessage(active.error)} />}
      {active.isPending && <LoadingState label={t('mapPage.loading')} />}
      {!active.isPending && !active.isError && (
        <>
          <p className='list-note'>
            {points.length
              ? t('mapPage.count', { count: points.length })
              : code ? t('mapPage.noneSpecies') : feed === 'notable' ? t('mapPage.noneNotable') : t('mapPage.noneWatch')}
          </p>
          <SightingsMap points={points} height='min(70vh, 620px)' ariaLabel={t('mapPage.mapLabel', { regionName })} />
        </>
      )}
    </section>
  )
}

export default MapPage
