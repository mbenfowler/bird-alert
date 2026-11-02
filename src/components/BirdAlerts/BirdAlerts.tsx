import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import AlertCard from '../AlertCard/AlertCard'
import ArrivalCard from '../ArrivalCard/ArrivalCard'
import { AlertIcon, ChevronIcon, CompassIcon, MapIcon, MigrationIcon, ShareIcon, StarIcon } from '../Icons/Icons'
import { LoadingState } from '../Loading/Loading'
import { useArrivalsQuery, useNotableQuery, useObservationsQuery, useRegionsQuery, useSavedCodes } from '../../hooks/queries'
import { useShownArea, useShownTargets } from '../../shownArea'
import './BirdAlerts.css'
import { countyWord } from '../../usStates'
import { isNewSince, previousVisit, watchVisits } from '../../lastVisit'
import { shareThing } from '../../share'
import type { Observation } from '../../types'
import { t } from '../../i18n'

type AlertType = 'star' | 'notable' | 'arriving'

const TITLES: Record<AlertType, string> = { star: 'alerts.watchLabel', notable: 'mapPage.notableLabel', arriving: 'alerts.arriving' }

/**
 * Recent sightings panel. Expanded on every visit; the user can collapse it to a one-line bar to
 * give the bird list the screen. Three tabs: birds on the watch list, eBird's notable sightings,
 * and species due back about now that have not been reported yet.
 */
const BirdAlerts = () => {
    // The area shown (home, a place the person is in, or one being explored); at a place, its
    // target birds count alongside the watch list.
    const area = useShownArea()
    const region = area.region
    const targets = useShownTargets(area)
    const [alertType, setAlertType] = useState<AlertType>('star')
    const [expanded, setExpanded] = useState(true)
    // Each tab's row starts at its first card, however far the previous one was scrolled.
    const listRef = useRef<HTMLDivElement>(null)
    useEffect(() => { listRef.current?.scrollTo({ left: 0 }) }, [alertType])
    // Sightings reported since the last visit ended get a New mark.
    const since = previousVisit()
    useEffect(() => { watchVisits() }, [])

    const observations = useObservationsQuery(region)
    const savedCodes = useSavedCodes()
    // The other feeds are only fetched once someone opens their tab.
    const notable = useNotableQuery(region, alertType === 'notable')
    const arriving = useArrivalsQuery(region, alertType === 'arriving')
    const regions = useRegionsQuery(area.state)
    const regionName = regions.data?.find(r => r.code === region)?.name ?? t('range.yourCounty', { word: countyWord(area.state) })

    const birdAlerts = useMemo(
      () => (observations.data ?? []).filter(obs => savedCodes.has(obs.speciesCode) || targets.has(obs.speciesCode)),
      [observations.data, savedCodes, targets]
    )

    const shown = alertType === 'star' ? birdAlerts : alertType === 'notable' ? (notable.data ?? []) : []
    // While a county's history is too thin to tell migrants from residents, the feed is every species
    // from this week last year; that list is not shown, only the note that we are still learning.
    const learning = Boolean(arriving.data?.learning)
    const arrivals = alertType === 'arriving' && !learning ? (arriving.data?.arrivals ?? []) : []
    const isLoading = alertType === 'star' ? observations.isPending : alertType === 'notable' ? notable.isPending : arriving.isPending
    const count = alertType === 'star' ? birdAlerts.length : alertType === 'notable' ? notable.data?.length : arriving.data ? arrivals.length : undefined
    const title = t(TITLES[alertType])
    const emptyText = alertType === 'star' ? t('alerts.emptyWatch')
      : alertType === 'notable' ? t('alerts.emptyNotable')
      : learning ? t('alerts.learning', { regionName })
      : t('alerts.allReported')

    const pick = (type: AlertType) => { setAlertType(type); setExpanded(true) }
    // The same link as the sighting page's Share: a page with the bird's picture and a map card.
    const shareSighting = (alert: Observation) => {
      void shareThing({ kind: 'sighting', speciesCode: alert.speciesCode, locId: alert.locId, locName: alert.locName, lat: alert.lat, lng: alert.lng, obsDt: alert.obsDt, howMany: alert.howMany ?? null, subId: alert.subId, regionName }, t('sighting.shareTitle', { name: alert.comName, place: alert.locName }))
    }

    return (
      <section id='birdAlerts' className={expanded ? 'is-expanded' : 'is-collapsed'} aria-labelledby='alertsHeading'>
          <div className='alerts-bar'>
            <div className='alerts-tabs' role='group' aria-label={t('alerts.typeLabel')}>
              <button type='button' className={`alert-icon ${alertType === 'star' ? 'button-pressed' : ''}`} id='star' aria-pressed={alertType === 'star'} aria-label={t('alerts.starLabel')} title={t('alerts.starTitle')} onClick={() => pick('star')}><StarIcon /></button>
              <button type='button' className={`alert-icon ${alertType === 'notable' ? 'button-pressed' : ''}`} id='notable' aria-pressed={alertType === 'notable'} aria-label={t('alerts.notableLabel')} title={t('mapPage.notableLabel')} onClick={() => pick('notable')}><AlertIcon /></button>
              <button type='button' className={`alert-icon ${alertType === 'arriving' ? 'button-pressed' : ''}`} id='arriving' aria-pressed={alertType === 'arriving'} aria-label={t('alerts.arrivingLabel')} title={t('alerts.arriving')} onClick={() => pick('arriving')}><MigrationIcon /></button>
            </div>
            <h2 id='alertsHeading' className='alerts-header'>
              <span className='alerts-title'>{title}</span>
              {count !== undefined && <span key={`${alertType}-${count}`} className='alerts-count' aria-label={t('alerts.count', { count })}>{count}</span>}
            </h2>
            <Link className='alerts-map-link alerts-go-link' to='/go' aria-label={t('alerts.goLabel')}><CompassIcon /><span>{t('alerts.go')}</span></Link>
            <Link className='alerts-map-link' to='/map' aria-label={t('alerts.mapLabel')}><MapIcon /><span>{t('alerts.map')}</span></Link>
            <button type='button' className='alerts-toggle' aria-expanded={expanded} aria-controls='alertsList' onClick={() => setExpanded(open => !open)}>
              <span>{expanded ? t('alerts.hide') : t('alerts.show')}</span>
              <ChevronIcon className={expanded ? 'is-up' : undefined} />
            </button>
          </div>
          {/* Height animates through grid rows; cards slide in one after another; collapsed content is inert. */}
          <div className='alerts-collapse' aria-hidden={!expanded} inert={!expanded}>
            <div className='alerts-collapse__inner'>
              {/* Keyed by tab, so switching tabs deals a fresh row: the cards slide in again. */}
              <div id='alertsList' key={alertType} className='alerts-list' ref={listRef}>
                {isLoading && <LoadingState variant='inline' label={t('alerts.loading')} />}
                {!isLoading && !shown.length && !arrivals.length && <p className='alerts-empty'>{emptyText}</p>}
                {shown.map((alert, index) => {
                  const isNew = isNewSince(alert.obsDt, since)
                  return (
                  // The card opens the sighting; the share button sits beside the link, not in it (a
                  // button inside a link would open the sighting too).
                  <div key={`${alert.subId}-${alert.speciesCode}`} className='alerts-item alerts-item--sighting' style={{ '--i': index } as React.CSSProperties}>
                    <Link className={`alert-link ${isNew ? 'is-new' : ''}`} to={`/sighting/${alert.speciesCode}/${alert.subId}${area.mode === 'home' ? '' : `?region=${area.region}`}`}>
                      {isNew && <span className='alert-new'><span className='alert-new__dot' aria-hidden='true' />{t('alerts.new')}<span className='visually-hidden'>{t('alerts.newHidden')}</span></span>}
                      <AlertCard alert={alert} />
                      <span className='visually-hidden'>{t('alerts.openHidden')}</span>
                    </Link>
                    <button type='button' className='alert-share' aria-label={t('alerts.shareLabel', { name: alert.comName })} title={t('route.share')} onClick={() => shareSighting(alert)}><ShareIcon /></button>
                  </div>
                  )
                })}
                {arrivals.map((arrival, index) => (
                  <div key={arrival.speciesCode} className='alerts-item' style={{ '--i': index } as React.CSSProperties}>
                    <ArrivalCard arrival={arrival} />
                  </div>
                ))}
              </div>
              {alertType === 'arriving' && !isLoading && (
                <p className='alerts-note'>
                  {t('alerts.judged')}{' '}
                  <a href={`https://dashboard.birdcast.info/region/${encodeURIComponent(region)}`} target='_blank' rel='noreferrer'>{t('alerts.radar', { regionName })}</a>
                </p>
              )}
            </div>
          </div>
      </section>
    )
}

export default BirdAlerts
