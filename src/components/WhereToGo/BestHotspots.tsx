import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import SightingsMap, { type MapPoint } from '../SightingsMap/SightingsMap'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useBestHotspotsQuery, useBirdsQuery, useCurrentUser, useRegionsQuery, useSpeciesHotspotsQuery } from '../../hooks/queries'
import { useDocked } from '../../hooks/useDocked'
import { countyWord } from '../../usStates'
import { useGoPlan } from '../../hooks/useGoPlan'
import { MAX_ROUTE_STOPS } from '../../routePlan'
import BirdPicker from './BirdPicker'
import './WhereToGo.css'

const PERIODS = [
  { days: 7, label: 'Past week', phrase: 'the past week' },
  { days: 30, label: 'Past month', phrase: 'the past month' },
  { days: 90, label: 'Past 3 months', phrase: 'the past 3 months' }
]
const DEFAULT_DAYS = 30
/** How many hotspots the list shows; for a bird the server sends every one, so either order can pick from all. */
const SHOWN = 25

type BirdSort = 'recent' | 'reliable'
const BIRD_SORTS: { sort: BirdSort; label: string }[] = [
  { sort: 'recent', label: 'Seen most recently' },
  { sort: 'reliable', label: 'Most reliable' }
]

const shortDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const daysFrom = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000) + 1
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** One ranked hotspot as the list and map show it, whichever ranking it came from. */
interface Row { locId: string; name: string; lat: number; lng: number; counts: string; links: ReactNode }

const ebirdLink = (href: string, text: ReactNode) => <a href={href} target='_blank' rel='noreferrer'>{text}</a>

/**
 * The county's hotspots ranked by how many species were reported there over the past week, month
 * or three months, from the checklists on file, with how many checklists that rests on and the best
 * single list. Bird Alert only began gathering a county when someone chose it, so a window reaching
 * further back than that says how much it really covers. With a bird picked, the hotspots where it
 * was reported, ranked by how reliably: the share of checklists that had it. The period and the
 * bird are kept in the address, so a bird's own page can link straight to its ranking.
 */
const BestHotspots = ({ onOpenRoute }: { onOpenRoute: () => void }) => {
  const user = useCurrentUser()
  const region = user.location
  // The same route as For your birds: a hotspot added here is a stop there.
  const { stops, toggle } = useGoPlan(region)
  const [params, setParams] = useSearchParams()
  const period = PERIODS.find(p => String(p.days) === params.get('days')) ?? PERIODS.find(p => p.days === DEFAULT_DAYS)!
  const setDays = (days: number) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('days', String(days)); return next }, { replace: true })
  const species = params.get('species')
  const setSpecies = (code: string | null) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    if (code) next.set('species', code)
    else next.delete('species')
    return next
  }, { replace: true })
  // For a bird: the latest report first (fresh news is what you chase), or most reliable (for planning).
  const sort: BirdSort = params.get('sort') === 'reliable' ? 'reliable' : 'recent'
  const setSort = (next: BirdSort) => setParams((prev) => {
    const out = new URLSearchParams(prev)
    if (next === 'reliable') out.set('sort', 'reliable')
    else out.delete('sort')
    return out
  }, { replace: true })
  const best = useBestHotspotsQuery(region, period.days, !species)
  const forBird = useSpeciesHotspotsQuery(region, period.days, species)
  const birds = useBirdsQuery(species ? [species] : [])
  const birdName = (forBird.data?.species.code === species ? forBird.data?.species.comName : undefined)
    ?? birds.data?.find(b => b.speciesCode === species)?.comName ?? null
  const shown = species ? forBird : best
  const regions = useRegionsQuery(user.state)
  const regionName = regions.data?.find(r => r.code === region)?.name ?? `your ${countyWord(user.state)}`
  const [selected, setSelected] = useState<string | null>(null)

  const rows = useMemo<Row[]>(() => species
    // The server ranks every hotspot by how reliably; the latest report re-sorts them (ties keep that order).
    ? [...(forBird.data?.hotspots ?? [])]
        .sort((a, b) => sort === 'recent' ? (b.lastSeen?.day ?? '').localeCompare(a.lastSeen?.day ?? '') : 0)
        .slice(0, SHOWN)
        .map(h => ({
        locId: h.locId, name: h.name, lat: h.lat, lng: h.lng,
        counts: `On ${h.reports} of ${plural(h.detailed, 'checklist')} (${Math.round(h.frequency * 100)}%)`,
        links: <>{h.lastSeen && <>Last seen {ebirdLink(`https://ebird.org/checklist/${h.lastSeen.subId}`, `${shortDay(h.lastSeen.day)}${h.lastSeen.howMany ? `, ${plural(h.lastSeen.howMany, 'bird')}` : ''}`)} · </>}{ebirdLink(`https://ebird.org/hotspot/${h.locId}`, 'Hotspot on eBird')}</>
      }))
    : (best.data?.hotspots ?? []).map(h => ({
        locId: h.locId, name: h.name, lat: h.lat, lng: h.lng,
        counts: `${h.species} species · ${plural(h.checklists, 'checklist')}`,
        links: <>{h.bestList && <>Best list {ebirdLink(`https://ebird.org/checklist/${h.bestList.subId}`, `${h.bestList.species} species on ${shortDay(h.bestList.day)}`)} · </>}{ebirdLink(`https://ebird.org/hotspot/${h.locId}`, 'Hotspot on eBird')}</>
      })), [species, sort, forBird.data, best.data])
  const points = useMemo<MapPoint[]>(() => rows.map((h, i) => ({
    id: h.locId,
    lat: h.lat,
    lng: h.lng,
    n: i + 1,
    title: `${i + 1}. ${h.name}`,
    subtitle: h.counts,
    highlight: h.locId === selected
  })), [rows, selected])
  const { frameRef, docked } = useDocked(rows.length)

  const periodChips = (
    <div className='timing go__periods' role='group' aria-label='Period'>
      {PERIODS.map(p => (
        <button key={p.days} type='button' className={`timing__option ${p.days === period.days ? 'is-selected' : ''}`} aria-pressed={p.days === period.days} onClick={() => setDays(p.days)}>{p.label}</button>
      ))}
    </div>
  )

  const birdFilter = species
    ? (
      <>
        <p className='best__bird'>
          <span className='best__bird-chip'>{birdName ?? species}<button type='button' aria-label={`Show every bird again, not just ${birdName ?? species}`} onClick={() => setSpecies(null)}>✕</button></span>
        </p>
        <div className='timing go__periods best__sort' role='group' aria-label='Order'>
          {BIRD_SORTS.map(o => (
            <button key={o.sort} type='button' className={`timing__option ${o.sort === sort ? 'is-selected' : ''}`} aria-pressed={o.sort === sort} onClick={() => setSort(o.sort)}>{o.label}</button>
          ))}
        </div>
      </>
    )
    : <BirdPicker region={region} regionName={regionName} onPick={setSpecies} />

  if (shown.isError) return <ErrorMessage networkError={errorMessage(shown.error)} />

  const onFile = shown.data?.onFile
  // A window reaching back before the first checklist on file covers less than it says: say how much.
  const shortWindow = shown.data && onFile?.firstDay && onFile.firstDay > shown.data.since ? daysFrom(onFile.firstDay, today()) : null
  const gathering = (onFile?.checklists ?? Infinity) < 20

  return (
    <section className='go best'>
      <header className='go__hero'>
        <div className='go__title-row'>
          <h1 className='fredericka go__title'>Best hotspots</h1>
          <p className='go__summary'>{species
            ? `Hotspots in ${regionName} where ${birdName ?? 'this bird'} was reported in ${period.phrase}, ${sort === 'recent' ? 'latest report first' : 'by how reliably'}.`
            : `${regionName}’s hotspots ranked by the species reported there in ${period.phrase}.`}</p>
          {periodChips}
          {birdFilter}
          {shortWindow !== null && onFile?.firstDay && (
            <p className='list-note best__note'>Bird Alert started gathering {regionName}’s checklists on {shortDay(onFile.firstDay)}, so this covers {plural(shortWindow, 'day')} so far.</p>
          )}
          {stops.length > 0 && (
            <p className='go__summary best__route'>Your route has {plural(stops.length, 'stop')}. <button type='button' className='link-button' onClick={onOpenRoute}>See your route</button></p>
          )}
          {onFile && onFile.detailed < onFile.checklists && onFile.detailed > 0 && (
            <p className='go__summary best__basis'>{species ? 'How reliably' : 'Species'} {species ? 'comes' : 'come'} from the {onFile.detailed.toLocaleString()} of {onFile.checklists.toLocaleString()} checklists on file that have their full species list.</p>
          )}
        </div>
      </header>

      {shown.isPending ? <LoadingState label='Ranking hotspots…' /> : (
        <div className={`go__frame ${docked ? 'is-docked' : ''}`} ref={frameRef}>
          <div className='go__map'>
            {points.length
              ? <SightingsMap points={points} height='100%' ariaLabel={species ? `Map of the hotspots in ${regionName} for ${birdName ?? 'this bird'}` : `Map of the best hotspots in ${regionName}`} openHighlighted
                  onPinClick={(hit) => { if (hit[0]) setSelected(hit[0].id) }} />
              : <p className='list-note go__nomap'>No hotspots to show yet.</p>}
          </div>
          <div className='go__list-col'>
            <div className='go__scroll'>
              {!rows.length && <p className='list-note go__empty'>{gathering
                ? `We’re still gathering ${regionName}’s checklists. A newly chosen ${countyWord(user.state)} fills in within a few minutes.`
                : species
                  ? `No hotspot checklists in ${regionName} reported ${birdName ?? 'this bird'} in ${period.phrase}.`
                  : `No hotspot checklists in ${regionName} in ${period.phrase}.`}</p>}
              <ol className='go__places best__list'>
                {rows.map((h, i) => (
                  <li key={h.locId} className={`go__place ${h.locId === selected ? 'is-current' : ''}`}>
                    <button type='button' className='go__place-head' onClick={() => setSelected(h.locId)} aria-current={h.locId === selected ? 'true' : undefined}>
                      <span className='best__rank'>{i + 1}</span>
                      <strong>{h.name}</strong>
                      <span className='go__place-meta best__counts'>{h.counts}</span>
                    </button>
                    <p className='best__links'>{h.links}</p>
                    {(() => {
                      const on = stops.some(st => st.locId === h.locId)
                      const full = !on && stops.length >= MAX_ROUTE_STOPS
                      return (
                        <button type='button' className={`pill-button go__quick-add ${on ? 'is-on' : ''}`} aria-pressed={on}
                          disabled={full} title={full ? `A route takes up to ${MAX_ROUTE_STOPS} stops` : undefined}
                          onClick={() => toggle({ locId: h.locId, name: h.name, lat: h.lat, lng: h.lng })}>
                          {on ? '✓ On route' : '+ Add to route'}
                        </button>
                      )
                    })()}
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
