import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useBirdsQuery, useNotableThisWeekQuery, useObservationsQuery, useRegionsQuery } from '../../hooks/queries'
import { countyName as fullCountyName, countyLabel, countyWord, stateName as fullStateName, stateOfCode, subnational1 } from '../../usStates'
import StateOptions from '../StateOptions/StateOptions'
import type { Observation } from '../../types'
import './Landing.css'
import AbaCode from '../AbaCode/AbaCode'

const REGION_KEY = 'bird-alert:landing-region'
const DEFAULT_REGION = 'US-GA-139'
const SHOWN = 6

const readRegion = () => { try { return localStorage.getItem(REGION_KEY) || DEFAULT_REGION } catch { return DEFAULT_REGION } }

/** "2 hours ago", "yesterday", "4 days ago" from eBird's local "YYYY-MM-DD HH:MM". */
const ago = (obsDt: string) => {
  const then = new Date(obsDt.replace(' ', 'T')).getTime()
  if (!Number.isFinite(then)) return ''
  const hours = Math.max(0, Math.round((Date.now() - then) / 3600000))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * Where, fit for a public page: hotspots by name, and someone's own location (eBird names those by
 * street address) only by its town.
 */
const placeLabel = (o: Observation) => {
  if (!o.locationPrivate) return o.locName.replace(/^Lake Lanier--/, '')
  // "…, Gainesville US-GA (…)" in the US; "…, Toronto, Ontario, CA (…)" in Canada.
  const town = o.locName.match(/,\s*([^,]+?)\s+US-[A-Z]{2}\b/)?.[1] ?? o.locName.match(/,\s*([^,]+?),\s*[^,]+,\s*CA\b/)?.[1]
  return town ? `A private yard near ${town}` : 'A private yard'
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

  const pickState = (code: string) => {
    // A new state starts on its first county once the list arrives; until then keep the old one.
    setRegion(subnational1(code))
  }
  // A whole state or province is two parts ('US-CO', 'MX-JAL', 'ZA-WC'); a county has three.
  const stateRegion = region.split('-').length === 2
  const countyChoices = regions.data ?? []

  return (
    <div className='landing'>
      <section className='landing__hero'>
        <div className='landing__pitch'>
          <p className='landing__kicker'>Free, for birders who’d rather be out there</p>
          <h1 className='fredericka landing__title'>Know where the birds are this morning.</h1>
          <p className='landing__lede'>
            Live sightings near you, your honest chances at each spot, and a short route that finds the most of your birds.
            Get a nudge the moment one you’re after is reported.
          </p>
          <div className='landing__ctas'>
            <Link className='pill-button pill-button--primary landing__cta' to='/login'>Start free</Link>
            <Link className='pill-button landing__cta' to='/login'>Log in</Link>
          </div>
          <p className='landing__fine'>No app store, no ads. Works on your phone’s home screen.</p>
        </div>

        <section className='landing__live' aria-labelledby='liveTitle'>
          <header className='landing__live-head'>
            <p className='landing__live-dot' aria-hidden='true'><span /></p>
            <div>
              <h2 id='liveTitle' className='landing__live-title'>Notable this week{placeName ? ` in ${placeName}` : ''}</h2>
              <p className='landing__live-sub'>Uncommon birds reported to eBird in the last 7 days</p>
            </div>
          </header>
          <div className='landing__pickers'>
            <label>
              <span className='visually-hidden'>State</span>
              <select className='select' value={state} onChange={(e) => pickState(e.target.value)}>
                <StateOptions />
              </select>
            </label>
            <label>
              <span className='visually-hidden'>{countyLabel(state)}</span>
              <select className='select' value={stateRegion ? '' : region} onChange={(e) => e.target.value && setRegion(e.target.value)} disabled={!countyChoices.length}>
                {stateRegion && <option value=''>All of {stateName}</option>}
                {countyChoices.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </label>
          </div>
          {notable.isPending ? (
              <ul className='landing__birds' aria-busy='true'>{Array.from({ length: 4 }, (_, i) => <li key={i} className='landing__bird is-loading'><span className='landing__thumb' /><span className='landing__bar' /></li>)}</ul>
            ) : notable.isError ? <p className='landing__live-note'>eBird didn’t answer just now. Try again in a minute.</p>
            : !rows.length ? <p className='landing__live-note'>Nothing unusual reported in {placeName ?? `this ${countyWord(state)}`} this week. A quiet week is a good week to look anyway.</p>
            : (
              <ul className='landing__birds'>
                {rows.map(({ latest: o, reports, places }) => (
                  <li key={o.speciesCode} className='landing__bird'>
                    {photo.get(o.speciesCode) ? <img className='landing__thumb' src={photo.get(o.speciesCode)!} alt='' loading='lazy' width='56' height='56' /> : <span className='landing__thumb landing__thumb--blank' aria-hidden='true'>🐦</span>}
                    <span className='landing__bird-text'>
                      <strong>{o.comName}{o.aba && o.aba >= 3 && o.aba <= 5 ? <> <AbaCode code={o.aba} /></> : null}</strong>
                      <span>{placeLabel(o)}</span>
                      <span className='landing__bird-meta'>{ago(o.obsDt)}{reports > 1 ? ` · ${reports} reports${places.size > 1 ? `, ${places.size} places` : ''}` : ''}</span>
                    </span>
                    <a className='landing__ebird' href={`https://ebird.org/checklist/${encodeURIComponent(o.subId)}`} target='_blank' rel='noreferrer' aria-label={`The ${o.comName} checklist on eBird`}>eBird ↗</a>
                  </li>
                ))}
              </ul>
            )}
          {total > SHOWN && <p className='landing__live-more'>+{total - SHOWN} more this week.</p>}
          {speciesLately > 0 && (
            <p className='landing__stat'><strong>{speciesLately}</strong> species reported in {placeName ?? `this ${countyWord(state)}`} in the last two weeks, and the app knows where each one was.</p>
          )}
          <Link className='landing__live-cta' to='/login'>Get told when the birds you want show up here →</Link>
        </section>
      </section>

      <section className='landing__features' aria-label='What it does'>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--odds' aria-hidden='true'>
            <p className='mock__place'>Chicopee Lake</p>
            <p className='mock__odds'><span className='mock__pct'>86%</span> chance to see it here</p>
            <p className='mock__meta'>best 8 am to 10 am · on 12 of 14 checklists</p>
          </div>
          <h3>Your odds, honestly</h3>
          <p>Every spot gets a real chance figure from recent checklists, faded as reports get old, and checked against what birders actually find.</p>
        </article>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--route' aria-hidden='true'>
            <ol>
              <li><span>1</span>Chicopee Lake</li>
              <li className='mock__leg'>↓ 6 min</li>
              <li><span>2</span>Elachee Nature Center</li>
              <li className='mock__leg'>↓ 18 min</li>
              <li><span>3</span>North Hall Park</li>
            </ol>
            <p className='mock__meta'>about 9 of your birds · 42 min of driving</p>
          </div>
          <h3>A morning route</h3>
          <p>Where to go for the most of your birds, in the order that wastes the least driving. Edit it, add any hotspot, send it to Maps.</p>
        </article>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--push' aria-hidden='true'>
            <p className='mock__app'><img src='/images/bird.png' alt='' width='18' height='18' /> Bird Alert! · now</p>
            <p className='mock__push-title'>⭐ Painted Bunting spotted nearby!</p>
            <p className='mock__meta'>Chicopee Lake · 8:10 am · 2 seen</p>
          </div>
          <h3>Alerts that matter</h3>
          <p>Your watch list, eBird’s rarities, the first migrant of the season back in town. Quiet hours respected, never the same bird twice.</p>
        </article>
        <article className='landing__feature'>
          <div className='landing__mock landing__mock--lifer' aria-hidden='true'>
            <p className='mock__push-title'>🎯 Lifer chance: Sedge Wren</p>
            <p className='mock__meta'>reported 9 miles away · not on your life list</p>
            <p className='mock__chip'>✓ 284 on your life list</p>
          </div>
          <h3>Lifers first</h3>
          <p>Bring your eBird life list in one go. The app points you at birds you’ve never seen, and tells you when one turns up.</p>
        </article>
      </section>

      <section className='landing__steps' aria-label='How it works'>
        <h2 className='fredericka'>Three minutes to set up</h2>
        <ol>
          <li><strong>Pick your county (an area in Canada, a municipality in Mexico or South Africa).</strong> Everything is local: your sightings, your hotspots, your migrants.</li>
          <li><strong>Star the birds you want.</strong> Or let the notable list and the arrivals pick for you.</li>
          <li><strong>Go.</strong> Alerts come to your phone; Where to go has the morning planned.</li>
        </ol>
        <Link className='pill-button pill-button--primary landing__cta' to='/login'>Start free</Link>
      </section>

      <footer className='landing__foot'>
        <p>Sightings and hotspots come from <a href='https://ebird.org' target='_blank' rel='noreferrer'>eBird</a>, the Cornell Lab’s community of birders. Bird sounds from <a href='https://xeno-canto.org' target='_blank' rel='noreferrer'>xeno-canto</a>.</p>
      </footer>
    </div>
  )
}

export default Landing
