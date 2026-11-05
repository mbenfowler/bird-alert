import { useState } from 'react'
import { Trans } from 'react-i18next'
import { Link } from 'react-router'
import AbaCode from '../AbaCode/AbaCode'
import Evidence from '../Evidence/Evidence'
import { LoadingState } from '../Loading/Loading'
import { useEventScoutingQuery, useSessionQuery } from '../../hooks/queries'
import { isNetworkError } from '../../offline'
import { countryOf } from '../../usStates'
import { t } from '../../i18n'
import type { GroupEvent, ScoutingBirdOfDay, ScoutingFresh } from '../../types'
import { rarestFirst, scoutSightingPath, targetRows, whenShort } from './scoutingRows'
import '../AlertCard/AlertCard.css'

const FRESH_SHOWN = 5

/** ABA heat only inside the ABA Area (the US and Canada), as on the alert cards. */
const useHeat = () => {
  const state = useSessionQuery().data?.state
  const inAbaArea = !state || ['US', 'CA'].includes(countryOf(state))
  return (aba: number | null | undefined) => (inAbaArea && aba && aba >= 1 && aba <= 5 ? aba : undefined)
}

const FreshRow = ({ bird, heat, to }: { bird: ScoutingFresh; heat: (aba?: number | null) => number | undefined; to: string }) => (
  <li className='scouting-today__fresh aba-heat' data-aba={heat(bird.aba)} data-testid='scouting-fresh'>
    <Link className='scouting-today__link' to={to}><strong className='scouting-today__name'>{bird.comName ?? bird.code}</strong></Link>
    {(bird.aba ?? 0) >= 3 && <> <AbaCode code={bird.aba} /></>}
    <span className='scouting-today__where'>{[bird.locName, whenShort(bird.obsDt)].filter(Boolean).map(part => ` · ${part}`).join('')}</span>
  </li>
)

const photoUrl = (photo: ScoutingBirdOfDay['photo']) => (typeof photo === 'string' ? photo : photo?.url) || null

/** The report the morning push led with: photo, name, ABA badge, where and when, and what it rests on. */
const BirdOfDay = ({ bird, heat, to }: { bird: ScoutingBirdOfDay; heat: (aba?: number | null) => number | undefined; to: string }) => {
  const [broken, setBroken] = useState(false)
  const photo = photoUrl(bird.photo)
  const credit = typeof bird.photo === 'object' ? bird.photo?.credit : null
  return (
    <div className='scouting-today__bod aba-heat' data-aba={heat(bird.aba)} data-testid='bird-of-day'>
      {photo && (
        <span className='scouting-today__photo'>
          {!broken && <img src={photo} alt='' width={64} height={64} loading='lazy' onError={() => setBroken(true)} title={credit ?? undefined} />}
        </span>
      )}
      <div className='scouting-today__bod-text'>
        <p className='scouting-today__label'>{t('scoutingToday.birdOfDay')}</p>
        <p className='scouting-today__bod-name'><Link className='scouting-today__link' to={to}><strong>{bird.comName ?? bird.code}</strong></Link>{(bird.aba ?? 0) >= 3 && <> <AbaCode code={bird.aba} /></>}</p>
        <p className='scouting-today__where'>{[bird.locName, whenShort(bird.obsDt)].filter(Boolean).join(' · ')}</p>
        {typeof bird.evidence === 'string'
          ? bird.evidence.trim() && <p className='evidence evidence--compact scouting-today__evidence'>{bird.evidence}</p>
          : <Evidence evidence={bird.evidence} compact />}
      </div>
    </div>
  )
}

/**
 * Today's scouting, high on the event page and where the morning push lands (#scouting): the
 * push's own line, the bird of the day, the other target reports new since yesterday (rarest
 * first), how many targets are around this week, and a link down to the places and map.
 */
const ScoutingToday = ({ event, onSeeWhere }: { event: GroupEvent; onSeeWhere: () => void }) => {
  const scouting = useEventScoutingQuery(event.id)
  const heat = useHeat()
  const [allFresh, setAllFresh] = useState(false)
  const data = scouting.data
  // The bird of the day leads the card, so it isn't listed again below it.
  const hero = data?.bird_of_day ?? null
  const anyFresh = (data?.fresh?.length ?? 0) > 0
  const fresh = rarestFirst((data?.fresh ?? []).filter(f => !hero || f.code !== hero.code))
  const shown = allFresh ? fresh : fresh.slice(0, FRESH_SHOWN)
  const lifers = data?.using === 'likely_lifers'
  const rows = data ? targetRows(event, data, code => code) : []
  const pathTo = (bird: ScoutingFresh | ScoutingBirdOfDay) => scoutSightingPath(event.location, bird, data?.reported ?? [])
  const got = lifers ? new Set(data?.reported.map(r => r.code)).size : rows.filter(row => row.status === 'around').length
  const total = lifers ? got + new Set(data?.unreported.map(u => u.code)).size : rows.filter(row => row.status).length
  return (
    <div id='scouting' tabIndex={-1} className='event-page__section scouting-today' data-testid='scouting-today'>
      <h2 className='place__heading'>{t('scoutingToday.title')}</h2>
      {scouting.isPending && <LoadingState variant='inline' label={t('scoutingView.loading')} />}
      {scouting.isError && !data && <p className='notification__hint'>{isNetworkError(scouting.error) ? t('offline.noSignalNothingSaved') : t('scoutingView.failed')}</p>}
      {data && (
        <>
          {data.headline && <p className='scouting-today__headline' data-testid='scouting-headline'>{data.headline}</p>}
          {hero && <BirdOfDay bird={hero} heat={heat} to={pathTo(hero)} />}
          {fresh.length > 0
            ? <>
                <p className='place__subheading'>{t('scoutingToday.newSince')}</p>
                <ul className='scouting-today__list'>
                  {shown.map((bird, i) => <FreshRow key={`${bird.code}-${bird.locId ?? bird.locName ?? i}`} bird={bird} heat={heat} to={pathTo(bird)} />)}
                </ul>
                {fresh.length > shown.length && (
                  <button type='button' className='link-button link-text scouting-today__more' onClick={() => setAllFresh(true)}>{t('scoutingView.moreBirds', { count: fresh.length - shown.length })}</button>
                )}
              </>
            : !anyFresh && <p className='scouting-today__quiet' data-testid='scouting-none-new'>{t('scoutingToday.noneNew')}</p>}
          {total > 0 && (
            <div className='event-scouting__summary'>
              <div className='event-scouting__bar' aria-hidden='true'><span style={{ width: `${Math.round((got / total) * 100)}%` }} /></div>
              <p className='event-scouting__progress' data-testid='scouting-progress'>
                <Trans i18nKey={lifers ? 'scoutingView.progressLifers' : 'scoutingToday.progress'} count={total} values={{ got, count: total }} components={{ b: <strong /> }} />
              </p>
            </div>
          )}
          <a className='link-text scouting-today__see' href='#scouting-details' onClick={(e) => { e.preventDefault(); onSeeWhere() }}>{t('scoutingToday.seeWhere')}</a>
        </>
      )}
    </div>
  )
}

export default ScoutingToday
