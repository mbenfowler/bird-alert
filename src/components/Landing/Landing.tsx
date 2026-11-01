import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useBirdsQuery, useNotableThisWeekQuery, useObservationsQuery, useRegionsQuery } from '../../hooks/queries'
import { countyName as fullCountyName, countyWord, stateName as fullStateName, stateOfCode, stateOfRegion } from '../../usStates'
import AreaPicker from '../AreaPicker/AreaPicker'
import type { Observation } from '../../types'
import './Landing.css'
import AbaCode from '../AbaCode/AbaCode'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

const REGION_KEY = 'bird-alert:landing-region'
const DEFAULT_REGION = 'US-GA-139'
const SHOWN = 6

const readRegion = () => { try { return localStorage.getItem(REGION_KEY) || DEFAULT_REGION } catch { return DEFAULT_REGION } }

/** "2 hours ago", "yesterday", "4 days ago" from eBird's local "YYYY-MM-DD HH:MM". */
const ago = (obsDt: string) => {
  const then = new Date(obsDt.replace(' ', 'T')).getTime()
  if (!Number.isFinite(then)) return ''
  const hours = Math.max(0, Math.round((Date.now() - then) / 3600000))
  if (hours < 1) return t('landing.justNow')
  if (hours < 24) return t('still.hoursAgo', { count: hours })
  const days = Math.round(hours / 24)
  return days === 1 ? t('landing.yesterday') : t('landing.daysAgo', { count: days })
}

/**
 * Where, fit for a public page: hotspots by name, and someone's own location (eBird names those by
 * street address) only by its town.
 */
const placeLabel = (o: Observation) => {
  if (!o.locationPrivate) return o.locName.replace(/^Lake Lanier--/, '')
  // "…, Gainesville US-GA (…)" in the US; "…, Toronto, Ontario, CA (…)" in Canada.
  const town = o.locName.match(/,\s*([^,]+?)\s+US-[A-Z]{2}\b/)?.[1] ?? o.locName.match(/,\s*([^,]+?),\s*[^,]+,\s*CA\b/)?.[1]
  return town ? t('landing.yardNear', { town }) : t('landing.yard')
}

/** Notable reports folded to one row per bird: its newest report and how many there were. */
const byBird = (rows: Observation[]) => {
  const birds = new Map<string, { latest: Observation; reports: number; places: Set<string> }>()
  for (const o of rows) {
    const b = birds.get(o.speciesCode)
    if (!b) birds.set(o.speciesCode, { latest: o, reports: 1, places: new Set([o.locId]) })
    else { b.reports += 1; b.places.add(o.locId); if (o.obsDt > b.latest.obsDt) b.latest = o }
  }
  return [...birds.values()].sort((a, b) => b.latest.obsDt.localeCompare(a.latest.obsDt))
}

/**
 * The front door for someone without an account: what the app does in a sentence, and, before
 * they sign up for anything, what's actually being seen in a county right now.
 */
const Landing = () => {
  const [region, setRegionState] = useState(readRegion)
  const setRegion = (code: string) => { setRegionState(code); try { localStorage.setItem(REGION_KEY, code) } catch { /* this visit only */ } }
  const state = stateOfCode(region)
  const regions = useRegionsQuery(state)
  const stateName = fullStateName(state)
  const countyName = regions.data?.find(r => r.code === region)?.name
  const placeName = countyName ? fullCountyName(countyName, state) : stateName
  const notable = useNotableThisWeekQuery(region)
  const rows = useMemo(() => byBird(notable.data ?? []).slice(0, SHOWN), [notable.data])
  const birds = useBirdsQuery(rows.map(r => r.latest.speciesCode))
  const photo = useMemo(() => new Map((birds.data ?? []).map(b => [b.speciesCode, b.birdImg && b.birdImg !== 'undefined' ? b.birdImg : null])), [birds.data])
  const total = useMemo(() => byBird(notable.data ?? []).length, [notable.data])
  // Everything reported lately, notable or not: how much there is to go and see.
  const recent = useObservationsQuery(region)
  const speciesLately = useMemo(() => new Set((recent.data ?? []).map(o => o.speciesCode)).size, [recent.data])

  // Another place: by location, by name, or by browsing, anywhere eBird covers.
  const [changing, setChanging] = useState(false)

  return (
    <div className='landing'>
      <section className='landing__hero'>
        <div className='landing__pitch'>
          <p className='landing__kicker'>{t('landing.kicker')}</p>
          <h1 className='fredericka landing__title'>{t('landing.title')}</h1>
          <p className='landing__lede'>{t('landing.lede')}</p>
          <div className='landing__ctas'>
            <Link className='pill-button pill-button--primary landing__cta' to='/login'>{t('landing.start')}</Link>
            <Link className='pill-button landing__cta' to='/login'>{t('nav.login')}</Link>
          </div>
          <p className='landing__fine'>{t('landing.fine')}</p>
        </div>

        <section className='landing__live' aria-labelledby='liveTitle'>
          <header className='landing__live-head'>
            <p className='landing__live-dot' aria-hidden='true'><span /></p>
            <div>
              <h2 id='liveTitle' className='landing__live-title'>{placeName ? t('landing.notableIn', { place: placeName }) : t('landing.notable')}</h2>
              <p className='landing__live-sub'>{t('landing.liveSub')}</p>
            </div>
          </header>
          <div className='landing__pickers'>
            {changing
              ? <AreaPicker current={stateOfRegion(region) ? { state, location: region } : null} onPick={(area) => { setRegion(area.location); setChanging(false) }} />
              : <button type='button' className='link-button link-text landing__change' onClick={() => setChanging(true)}>{t('landing.changePlace')}</button>}
          </div>
          {notable.isPending ? (
              <ul className='landing__birds' aria-busy='true'>{Array.from({ length: 4 }, (_, i) => <li key={i} className='landing__bird is-loading'><span className='landing__thumb' /><span className='landing__bar' /></li>)}</ul>
            ) : notable.isError ? <p className='landing__live-note'>{t('landing.ebirdDown')}</p>
            : !rows.length ? <p className='landing__live-note'>{t('landing.quiet', { place: placeName ?? t('landing.thisArea', { word: countyWord(state) }) })}</p>
            : (
              <ul className='landing__birds'>
                {rows.map(({ latest: o, reports, places }) => (
                  <li key={o.speciesCode} className='landing__bird'>
                    {photo.get(o.speciesCode) ? <img className='landing__thumb' src={photo.get(o.speciesCode)!} alt='' loading='lazy' width='56' height='56' /> : <span className='landing__thumb landing__thumb--blank' aria-hidden='true'>🐦</span>}
                    <span className='landing__bird-text'>
                      <strong>{o.comName}{o.aba && o.aba >= 3 && o.aba <= 5 ? <> <AbaCode code={o.aba} /></> : null}</strong>
                      <span>{placeLabel(o)}</span>
                      <span className='landing__bird-meta'>{ago(o.obsDt)}{reports > 1 ? ` · ${places.size > 1 ? t('landing.reportsPlaces', { reports, places: places.size }) : t('landing.reports', { count: reports })}` : ''}</span>
                    </span>
                    <a className='landing__ebird' href={`https://ebird.org/checklist/${encodeURIComponent(o.subId)}`} target='_blank' rel='noreferrer' aria-label={t('landing.checklistLabel', { name: o.comName })}>{t('landing.ebirdLink')}</a>
                  </li>
                ))}
              </ul>
            )}
          {total > SHOWN && <p className='landing__live-more'>{t('landing.more', { count: total - SHOWN })}</p>}
          {speciesLately > 0 && (
            <p className='landing__stat'><Trans i18nKey='landing.stat' count={speciesLately} values={{ count: speciesLately, place: placeName ?? t('landing.thisArea', { word: countyWord(state) }) }} components={{ b: <strong /> }} /></p>
          )}
          <Link className='landing__live-cta' to='/login'>{t('landing.liveCta')}</Link>
        </section>
      </section>

      <section className='landing__features' aria-label={t('landing.featuresLabel')}>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--odds' aria-hidden='true'>
            <p className='mock__place'>{t('landing.mock.place1')}</p>
            <p className='mock__odds'><Trans i18nKey='landing.mock.odds' components={{ pct: <span className='mock__pct' /> }} /></p>
            <p className='mock__meta'>{t('landing.mock.oddsMeta')}</p>
          </div>
          <h3>{t('landing.oddsTitle')}</h3>
          <p>{t('landing.oddsText')}</p>
        </article>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--route' aria-hidden='true'>
            <ol>
              <li><span>1</span>{t('landing.mock.place1')}</li>
              <li className='mock__leg'>{t('landing.mock.leg', { n: 6 })}</li>
              <li><span>2</span>{t('landing.mock.place2')}</li>
              <li className='mock__leg'>{t('landing.mock.leg', { n: 18 })}</li>
              <li><span>3</span>{t('landing.mock.place3')}</li>
            </ol>
            <p className='mock__meta'>{t('landing.mock.routeMeta')}</p>
          </div>
          <h3>{t('landing.routeTitle')}</h3>
          <p>{t('landing.routeText')}</p>
        </article>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--push' aria-hidden='true'>
            <p className='mock__app'><img src='/images/bird.png' alt='' width='18' height='18' /> {t('landing.mock.app')}</p>
            <p className='mock__push-title'>{t('landing.mock.pushTitle')}</p>
            <p className='mock__meta'>{t('landing.mock.pushMeta')}</p>
          </div>
          <h3>{t('landing.alertsTitle')}</h3>
          <p>{t('landing.alertsText')}</p>
        </article>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--lifer' aria-hidden='true'>
            <p className='mock__push-title'>{t('landing.mock.liferTitle')}</p>
            <p className='mock__meta'>{t('landing.mock.liferMeta')}</p>
            <p className='mock__chip'>{t('landing.mock.liferChip')}</p>
          </div>
          <h3>{t('landing.lifersTitle')}</h3>
          <p>{t('landing.lifersText')}</p>
        </article>
      </section>

      <section className='landing__steps' aria-label={t('landing.stepsLabel')}>
        <h2 className='fredericka'>{t('landing.stepsTitle')}</h2>
        <ol>
          <li><Trans i18nKey='landing.step1' components={{ b: <strong /> }} /></li>
          <li><Trans i18nKey='landing.step2' components={{ b: <strong /> }} /></li>
          <li><Trans i18nKey='landing.step3' components={{ b: <strong /> }} /></li>
        </ol>
        <Link className='pill-button pill-button--primary landing__cta' to='/login'>{t('landing.start')}</Link>
      </section>

      <footer className='landing__foot'>
        <p><Trans i18nKey='landing.credit' components={{ ebird: <a href='https://ebird.org' target='_blank' rel='noreferrer' />, xc: <a href='https://xeno-canto.org' target='_blank' rel='noreferrer' /> }} /></p>
      </footer>
    </div>
  )
}

export default Landing
