import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBestHotspotsQuery, useCurrentUser, useRegionsQuery } from '../../hooks/queries'
import { useDocked } from '../../hooks/useDocked'
import { countyWord } from '../../usStates'
import './WhereToGo.css'

const PERIODS = [
  { days: 7, label: 'Past week', phrase: 'the past week' },
  { days: 30, label: 'Past month', phrase: 'the past month' },
  { days: 90, label: 'Past 3 months', phrase: 'the past 3 months' }
]
const DEFAULT_DAYS = 30

const shortDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const daysFrom = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000) + 1
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The county's hotspots ranked by how many species were reported there over the past week, month
 * or three months, from the checklists on file, with how many checklists that rests on and the best
 * single list. Bird Alert only began gathering a county when someone chose it, so a window reaching
 * further back than that says how much it really covers. The period is kept in the address.
 */
const BestHotspots = () => {
  const user = useCurrentUser()
  const region = user.location
  const [params, setParams] = useSearchParams()
  const period = PERIODS.find(p => String(p.days) === params.get('days')) ?? PERIODS.find(p => p.days === DEFAULT_DAYS)!
  const setDays = (days: number) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('days', String(days)); return next }, { replace: true })
  const best = useBestHotspotsQuery(region, period.days)
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? `your ${countyWord(user.state)}`
  const [selected, setSelected] = useState<string | null>(null)

  const hotspots = useMemo(() => best.data?.hotspots ?? [], [best.data])
  const points = useMemo<MapPoint[]>(() => hotspots.map((h, i) => ({
    id: h.locId,
    lat: h.lat,
    lng: h.lng,
    n: i + 1,
    title: `${i + 1}. ${h.name}`,
    subtitle: `${h.species} species · ${plural(h.checklists, 'checklist')}`,
    highlight: h.locId === selected
  })), [hotspots, selected])
  const { frameRef, docked } = useDocked(hotspots.length)

  const periodChips = (
    <div className='timing go__periods' role='group' aria-label='Period'>
      {PERIODS.map(p => (
        <button key={p.days} type='button' className={`timing__option ${p.days === period.days ? 'is-selected' : ''}`} aria-pressed={p.days === period.days} onClick={() => setDays(p.days)}>{p.label}</button>
      ))}
    </div>
  )

  if (best.isError) return <ErrorMessage networkError={errorMessage(best.error)} />

  const onFile = best.data?.onFile
  // A window reaching back before the first checklist on file covers less than it says: say how much.
  const shortWindow = best.data && onFile?.firstDay && onFile.firstDay > best.data.since ? daysFrom(onFile.firstDay, today()) : null
  const gathering = (onFile?.checklists ?? Infinity) < 20

  return (
    <section className='go best'>
      <header className='go__hero'>
        <div className='go__title-row'>
          <h1 className='fredericka go__title'>Best hotspots</h1>
          <p className='go__summary'>{regionName}’s hotspots ranked by the species reported there in {period.phrase}.</p>
          {periodChips}
          {shortWindow !== null && onFile?.firstDay && (
            <p className='list-note best__note'>Bird Alert started gathering {regionName}’s checklists on {shortDay(onFile.firstDay)}, so this covers {plural(shortWindow, 'day')} so far.</p>
          )}
          {onFile && onFile.detailed < onFile.checklists && onFile.detailed > 0 && (
            <p className='go__summary best__basis'>Species come from the {onFile.detailed.toLocaleString()} of {onFile.checklists.toLocaleString()} checklists on file that have their full species list.</p>
          )}
        </div>
      </header>

      {best.isPending ? <LoadingState label='Ranking hotspots…' /> : (
        <div className={`go__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
          <div className='go__map'>
            {points.length
              ? <SightingsMap points={points} height='100%' ariaLabel={`Map of the best hotspots in ${regionName}`} openHighlighted
                  onPinClick={(hit) => { if (hit[0]) setSelected(hit[0].id) }} />
              : <p className='list-note go__nomap'>No hotspots to show yet.</p>}
          </div>
          <div className='go__list-col'>
            <div className='go__scroll'>
              {!hotspots.length && <p className='list-note go__empty'>{gathering
                ? `We’re still gathering ${regionName}’s checklists. A newly chosen ${countyWord(user.state)} fills in within a few minutes.`
                : `No hotspot checklists in ${regionName} in ${period.phrase}.`}</p>}
              <ol className='go__places best__list'>
                {hotspots.map((h, i) => (
                  <li key={h.locId} className={`go__place ${h.locId === selected ? 'is-current' : ''}`}>
                    <button type='button' className='go__place-head' onClick={() => setSelected(h.locId)} aria-current={h.locId === selected ? 'true' : undefined}>
                      <span className='best__rank'>{i + 1}</span>
                      <strong>{h.name}</strong>
                      <span className='go__place-meta best__counts'>{h.species} species · {plural(h.checklists, 'checklist')}</span>
                    </button>
                    <p className='best__links'>
                      {h.bestList && <>Best list <a href={`https://ebird.org/checklist/${h.bestList.subId}`} target='_blank' rel='noreferrer'>{h.bestList.species} species on {shortDay(h.bestList.day)}</a> · </>}
                      <a href={`https://ebird.org/hotspot/${h.locId}`} target='_blank' rel='noreferrer'>Hotspot on eBird</a>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default BestHotspots
