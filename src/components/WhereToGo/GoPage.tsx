import { useSearchParams } from 'react-router'
import WhereToGo from './WhereToGo'
import BestHotspots from './BestHotspots'

export type GoTab = 'birds' | 'best'

/** Which Where to go tab is open: kept in the address (?tab=best), so a link opens the same one. */
const useGoTab = () => {
  const [params, setParams] = useSearchParams()
  const tab: GoTab = params.get('tab') === 'best' ? 'best' : 'birds'
  const setTab = (next: GoTab) => setParams(next === 'best' ? { tab: 'best' } : new URLSearchParams(), { replace: true })
  return [tab, setTab] as const
}

const TABS: { tab: GoTab; label: string }[] = [
  { tab: 'birds', label: 'For your birds' },
  { tab: 'best', label: 'Best hotspots' }
]

/**
 * Where to go, two ways: the places for your watch list (or lifers) with a route, and the county's
 * hotspots ranked by what's been reported there lately.
 */
const GoPage = () => {
  const [tab, setTab] = useGoTab()
  return (
    <>
      <div className='go-tabs'>
        <div className='timing go-tabs__switch' role='group' aria-label='Where to go'>
          {TABS.map(({ tab: t, label }) => (
            <button key={t} type='button' className={`timing__option ${tab === t ? 'is-selected' : ''}`} aria-pressed={tab === t} onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>
      </div>
      {tab === 'best' ? <BestHotspots /> : <WhereToGo />}
    </>
  )
}

export default GoPage
