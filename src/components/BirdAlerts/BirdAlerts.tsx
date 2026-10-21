import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import AlertCard from '../AlertCard/AlertCard'
import ArrivalCard from '../ArrivalCard/ArrivalCard'
import { AlertIcon, ChevronIcon, MapIcon, MigrationIcon, StarIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { useArrivalsQuery, useCurrentUser, useNotableQuery, useObservationsQuery, useRegionsQuery, useSavedCodes } from '../../hooks/queries'
import './BirdAlerts.css'

type AlertType = 'star' | 'notable' | 'arriving'

const TITLES: Record<AlertType, string> = { star: 'Watch list sightings', notable: 'Notable sightings', arriving: 'Arriving soon' }

/**
 * Recent sightings panel. Expanded on every visit; the user can collapse it to a one-line bar to
 * give the bird list the screen. Three tabs: birds on the watch list, eBird's notable sightings,
 * and species due back about now that have not been reported yet.
 */
const BirdAlerts = () => {
    const user = useCurrentUser()
    const region = user.location
    const [alertType, setAlertType] = useState<AlertType>('star')
    const [expanded, setExpanded] = useState(true)

    const observations = useObservationsQuery(region)
    const savedCodes = useSavedCodes()
    // The other feeds are only fetched once someone opens their tab.
    const notable = useNotableQuery(region, alertType === 'notable')
    const arriving = useArrivalsQuery(region, alertType === 'arriving')
    const regions = useRegionsQuery(user.state)
    const regionName = regions.data?.find(r => r.code === region)?.name ?? 'your county'

    const birdAlerts = useMemo(
      () => (observations.data ?? []).filter(obs => savedCodes.has(obs.speciesCode)),
      [observations.data, savedCodes]
    )

    const shown = alertType === 'star' ? birdAlerts : alertType === 'notable' ? (notable.data ?? []) : []
    const arrivals = alertType === 'arriving' ? (arriving.data?.arrivals ?? []) : []
    const isLoading = alertType === 'star' ? observations.isPending : alertType === 'notable' ? notable.isPending : arriving.isPending
    const count = alertType === 'star' ? birdAlerts.length : alertType === 'notable' ? notable.data?.length : arriving.data?.arrivals?.length
    const title = TITLES[alertType]
    const emptyText = alertType === 'star' ? 'No birds from your watch list have been reported nearby in the last two weeks.'
      : alertType === 'notable' ? 'No notable sightings reported nearby in the last month.'
      : arriving.data?.learning ? `Still learning the seasons for ${regionName}; check back in a day or two.`
      : 'Everything that was around this time last year has already been reported.'

    const pick = (type: AlertType) => { setAlertType(type); setExpanded(true) }

    return (
      <section id='birdAlerts' className={expanded ? 'is-expanded' : 'is-collapsed'} aria-labelledby='alertsHeading'>
          <div className='alerts-bar'>
            <div className='alerts-tabs' role='group' aria-label='Alert type'>
              <button type='button' className={`alert-icon ${alertType === 'star' ? 'button-pressed' : ''}`} id='star' aria-pressed={alertType === 'star'} aria-label='Sightings of birds on your watch list' title='Your watch list' onClick={() => pick('star')}><StarIcon /></button>
              <button type='button' className={`alert-icon ${alertType === 'notable' ? 'button-pressed' : ''}`} id='notable' aria-pressed={alertType === 'notable'} aria-label='Notable sightings in your area' title='Notable sightings' onClick={() => pick('notable')}><AlertIcon /></button>
              <button type='button' className={`alert-icon ${alertType === 'arriving' ? 'button-pressed' : ''}`} id='arriving' aria-pressed={alertType === 'arriving'} aria-label='Birds arriving soon in your area' title='Arriving soon' onClick={() => pick('arriving')}><MigrationIcon /></button>
            </div>
            <h2 id='alertsHeading' className='alerts-header'>
              <span className='alerts-title'>{title}</span>
              {count !== undefined && <span key={`${alertType}-${count}`} className='alerts-count' aria-label={`${count} alerts`}>{count}</span>}
            </h2>
            <Link className='alerts-map-link' to='/map' aria-label='Open the region map'><MapIcon /><span>Map</span></Link>
            <button type='button' className='alerts-toggle' aria-expanded={expanded} aria-controls='alertsList' onClick={() => setExpanded(open => !open)}>
              <span>{expanded ? 'Hide' : 'Show'}</span>
              <ChevronIcon className={expanded ? 'is-up' : undefined} />
            </button>
          </div>
          {/* Height animates through grid rows; cards slide in one after another; collapsed content is inert. */}
          <div className='alerts-collapse' aria-hidden={!expanded} inert={!expanded}>
            <div className='alerts-collapse__inner'>
              <div id='alertsList' className='alerts-list'>
                {isLoading && <LoadingState variant='inline' label='Loading sightings' />}
                {!isLoading && !shown.length && !arrivals.length && <p className='alerts-empty'>{emptyText}</p>}
                {shown.map((alert, index) => (
                  <Link key={`${alert.subId}-${alert.speciesCode}`} style={{ '--i': index } as React.CSSProperties} to={`/sighting/${alert.speciesCode}/${alert.subId}`}>
                    <AlertCard alert={alert} />
                    <span className='visually-hidden'>, open sighting details</span>
                  </Link>
                ))}
                {arrivals.map((arrival, index) => (
                  <div key={arrival.speciesCode} className='alerts-item' style={{ '--i': index } as React.CSSProperties}>
                    <ArrivalCard arrival={arrival} />
                  </div>
                ))}
              </div>
              {alertType === 'arriving' && !isLoading && (
                <p className='alerts-note'>
                  Judged by eBird reports from this time last year.{' '}
                  <a href={`https://dashboard.birdcast.info/region/${encodeURIComponent(region)}`} target='_blank' rel='noreferrer'>Tonight's migration radar for {regionName}</a>
                </p>
              )}
            </div>
          </div>
      </section>
    )
}

export default BirdAlerts
