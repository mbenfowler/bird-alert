import { useSearchParams } from 'react-router'
import WhereToGo from './WhereToGo'
import BestHotspots from './BestHotspots'
import AreaBanner from '../AreaBanner/AreaBanner'
import { t } from '../../i18n'

export type GoTab = 'birds' | 'best'

/** Which Where to go tab is open: kept in the address (?tab=best), so a link opens the same one. */
const useGoTab = () => {
  const [params, setParams] = useSearchParams()
  const tab: GoTab = params.get('tab') === 'best' ? 'best' : 'birds'
  // An explored area (?region=) stays in the address across tabs, so the link still names it.
  const setTab = (next: GoTab) => setParams((prev) => {
    const kept = new URLSearchParams()
    if (prev.get('region')) kept.set('region', prev.get('region')!)
    if (next === 'best') kept.set('tab', 'best')
    return kept
  }, { replace: true })
  return [tab, setTab] as const
}

const TABS: { tab: GoTab; label: string }[] = [
  { tab: 'birds', label: 'go.tabBirds' },
  { tab: 'best', label: 'go.tabBest' }
]

/**
 * Where to go, two ways: the places for your watch list (or lifers) with a route, and the county's
 * hotspots ranked by what's been reported there lately.
 */
const GoPage = () => {
  const [tab, setTab] = useGoTab()
  return (
    <>
      <AreaBanner />
      <div className='go-tabs'>
        <div className='timing go-tabs__switch' role='group' aria-label={t('go.tabsLabel')}>
          {TABS.map(({ tab: which, label }) => (
            <button key={which} type='button' className={`timing__option ${tab === which ? 'is-selected' : ''}`} aria-pressed={tab === which} onClick={() => setTab(which)}>{t(label)}</button>
          ))}
        </div>
      </div>
      {tab === 'best' ? <BestHotspots onOpenRoute={() => setTab('birds')} /> : <WhereToGo />}
    </>
  )
}

export default GoPage
