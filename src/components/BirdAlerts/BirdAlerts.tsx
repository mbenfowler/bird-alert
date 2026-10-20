import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import AlertCard from '../AlertCard/AlertCard'
import { AlertIcon, ChevronIcon, MapIcon, StarIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { useCurrentUser, useNotableQuery, useObservationsQuery, useSavedCodes } from '../../hooks/queries'
import './BirdAlerts.css'

type AlertType = 'star' | 'notable'

/**
 * Recent sightings panel. Expanded on every visit; the user can collapse it to a one-line bar to
 * give the bird list the screen. Two tabs: birds on the watch list, and eBird's notable sightings.
 */
const BirdAlerts = () => {
    const user = useCurrentUser()
    const region = user.location
    const [alertType, setAlertType] = useState<AlertType>('star')
    const [expanded, setExpanded] = useState(true)

    const observations = useObservationsQuery(region)
    const savedCodes = useSavedCodes()
    // Notable sightings are only fetched once someone opens that tab.
    const notable = useNotableQuery(region, alertType === 'notable')

    const birdAlerts = useMemo(
      () => (observations.data ?? []).filter(obs => savedCodes.has(obs.speciesCode)),
      [observations.data, savedCodes]
    )

    const shown = alertType === 'star' ? birdAlerts : (notable.data ?? [])
    const isLoading = alertType === 'star' ? observations.isPending : notable.isPending
    const count = alertType === 'star' ? birdAlerts.length : notable.data?.length
    const title = alertType === 'star' ? 'Watch list sightings' : 'Notable sightings'

    const pick = (type: AlertType) => { setAlertType(type); setExpanded(true) }

    return (
      <section id='birdAlerts' className={expanded ? 'is-expanded' : 'is-collapsed'} aria-labelledby='alertsHeading'>
          <div className='alerts-bar'>
            <div className='alerts-tabs' role='group' aria-label='Alert type'>
              <button type='button' className={`alert-icon ${alertType === 'star' ? 'button-pressed' : ''}`} id='star' aria-pressed={alertType === 'star'} aria-label='Sightings of birds on your watch list' title='Your watch list' onClick={() => pick('star')}><StarIcon /></button>
              <button type='button' className={`alert-icon ${alertType === 'notable' ? 'button-pressed' : ''}`} id='notable' aria-pressed={alertType === 'notable'} aria-label='Notable sightings in your area' title='Notable sightings' onClick={() => pick('notable')}><AlertIcon /></button>
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
                {!isLoading && !shown.length && (
                  <p className='alerts-empty'>
                    {alertType === 'star' ? 'No birds from your watch list have been reported nearby in the last two weeks.' : 'No notable sightings reported nearby in the last month.'}
                  </p>
                )}
                {shown.map((alert, index) => (
                  <Link key={`${alert.subId}-${alert.speciesCode}`} style={{ '--i': index } as React.CSSProperties} to={`/sighting/${alert.speciesCode}/${alert.subId}`}>
                    <AlertCard alert={alert} />
                    <span className='visually-hidden'>, open sighting details</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
      </section>
    )
}

export default BirdAlerts
