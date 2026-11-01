import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { formatObsDt } from '../../format'
import { parseSightingRefs, useCurrentUser, useRegionsQuery, useSightingsQuery } from '../../hooks/queries'
import './AlertSightings.css'
import { countyLabel, useLinkRegion } from '../../linkRegion'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

/**
 * Where a watch-list push notification lands: every sighting it announced on one small map, with
 * a table of the details beneath. The link carries the species and checklist ids (?s=code:subId,…).
 */
const AlertSightings = () => {
  const user = useCurrentUser()
  const { region, state, own, query } = useLinkRegion(user)
  const [params] = useSearchParams()
  const refs = useMemo(() => parseSightingRefs(params.get('s')), [params])
  const sightings = useSightingsQuery(region, refs)
  const regions = useRegionsQuery(state)
  const regionName = countyLabel(regions.data?.find(r => r.code === region)?.name, state, own)

  const rows = useMemo(() => sightings.data ?? [], [sightings.data])
  // Tapping a pin, or a row, highlights that place on both the map and the table.
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null)
  const placeOf = (o: { lat: number; lng: number }) => `${o.lat},${o.lng}`
  const points = useMemo<MapPoint[]>(() => rows.map(o => ({
    id: `${o.speciesCode}-${o.subId}-${o.lat}-${o.lng}`,
    lat: o.lat,
    lng: o.lng,
    title: o.comName,
    subtitle: `${o.locName} · ${formatObsDt(o.obsDt)}`,
    href: `/sighting/${o.speciesCode}/${o.subId}${query}`,
    highlight: selectedPlace === `${o.lat},${o.lng}`
  })), [rows, selectedPlace, query])
  const missing = refs.length - new Set(rows.map(o => o.speciesCode)).size

  return (
    <section className='alert-sightings'>
      <h1 className='fredericka'>{t('alerts.watchLabel')}</h1>
      {!refs.length && <p className='list-note'><Trans i18nKey='alertSightings.noRefs' components={{ home: <Link to='/' /> }} /></p>}
      {sightings.isError && <ErrorMessage networkError={errorMessage(sightings.error)} />}
      {sightings.isPending && refs.length > 0 && <LoadingState label={t('mapPage.loading')} />}
      {sightings.isSuccess && (
        <>
          <p className='list-note'>
            {rows.length
              ? t('alertSightings.count', { count: rows.length, regionName })
              : t('alertSightings.gone')}
            {missing > 0 && rows.length > 0 ? ` ${t('alertSightings.missing', { count: missing })}` : ''}
          </p>
          {rows.length > 0 && (
            <>
              <SightingsMap points={points} height='min(45vh, 340px)' ariaLabel={t('alertSightings.mapLabel', { regionName })}
                onPinClick={(hit) => setSelectedPlace(hit[0] ? `${hit[0].lat},${hit[0].lng}` : null)} />
              <table className='alert-sightings__table'>
                <thead>
                  <tr><th scope='col'>{t('alertSightings.bird')}</th><th scope='col'>{t('alertSightings.when')}</th><th scope='col'>{t('alertSightings.seen')}</th></tr>
                </thead>
                <tbody>
                  {rows.map(o => (
                    <tr key={`${o.speciesCode}-${o.subId}-${o.lat}-${o.lng}`} className={selectedPlace === placeOf(o) ? 'is-selected' : undefined}
                      aria-selected={selectedPlace === placeOf(o)} onClick={() => setSelectedPlace(placeOf(o))}>
                      <td>
                        <Link to={`/sighting/${o.speciesCode}/${o.subId}${query}`}>{o.comName}</Link>
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
