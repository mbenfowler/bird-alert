import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import BirdsList from '../BirdsList/BirdsList'
import ListTabs from '../ListTabs/ListTabs'
import ErrorMessage from '../Error/ErrorMessage'
import { SkeletonList } from '../Loading/Loading'
import { SearchIcon, CloseIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { useInfiniteBirdsQuery, useSeenBirdsQuery } from '../../hooks/queries'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { SeenBird } from '../../types'
import './LifeListPage.css'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

const PAGE_SIZE = 12
type Sort = 'newest' | 'name' | 'taxonomic'
const SORT_KEY = 'bird-alert:life-sort'
const readSort = (): Sort => { try { const v = localStorage.getItem(SORT_KEY); return v === 'name' || v === 'taxonomic' ? v : 'newest' } catch { return 'newest' } }

const sorters: Record<Sort, (a: SeenBird, b: SeenBird) => number> = {
  newest: (a, b) => (b.firstSeen ?? '').localeCompare(a.firstSeen ?? '') || (a.comName ?? a.speciesCode).localeCompare(b.comName ?? b.speciesCode),
  name: (a, b) => (a.comName ?? a.speciesCode).localeCompare(b.comName ?? b.speciesCode),
  taxonomic: (a, b) => (a.taxonOrder ?? Infinity) - (b.taxonOrder ?? Infinity) || (a.comName ?? a.speciesCode).localeCompare(b.comName ?? b.speciesCode)
}

/**
 * The life list, as cards: newest first, by name or in taxonomic order, with a search. Untick a
 * card to take it off (the toast offers it back). The order is fixed while you work, so taking one
 * off doesn't send the page back to the top.
 */
const LifeListPage = () => {
  const seen = useSeenBirdsQuery()
  const [sort, setSortState] = useState<Sort>(readSort)
  const setSort = (next: Sort) => { setSortState(next); try { localStorage.setItem(SORT_KEY, next) } catch { /* this visit only */ } }
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim().toLowerCase(), 250)

  // The order is taken once per sort or search, so removals don't reshuffle what's loaded.
  const [snapshot, setSnapshot] = useState<{ key: string; codes: string[] } | null>(null)
  const key = `${sort}|${term}`
  const list = useMemo(() => seen.data ?? [], [seen.data])
  let codes = snapshot?.key === key ? snapshot.codes : null
  if (!codes && seen.data) {
    codes = [...list].filter(b => !term || (b.comName ?? b.speciesCode).toLowerCase().includes(term)).sort(sorters[sort]).map(b => b.speciesCode)
    setSnapshot({ key, codes })
  }
  const pages = useInfiniteBirdsQuery('life-list', codes ?? [], PAGE_SIZE)
  const firstSeen = useMemo(() => new Map(list.map(b => [b.speciesCode, b.firstSeen])), [list])
  const birds = useMemo(() => (pages.data?.pages.flat() ?? [])
    .filter(b => firstSeen.has(b.speciesCode))
    .map(b => ({ ...b, firstSeen: firstSeen.get(b.speciesCode) ?? null })), [pages.data, firstSeen])
  const loadMore = () => { if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage() }
  const sentinelRef = useInfiniteScroll(loadMore, Boolean(pages.hasNextPage) && !pages.isFetchingNextPage)

  if (seen.isError) return <ErrorMessage networkError={errorMessage(seen.error)} />
  const count = list.length

  return (
    <section id='birdsInArea' className='life-page'>
      <ListTabs lifeCount={count} />
      <h2 className='fredericka list-heading'>{count ? t('lifePage.titleCount', { count }) : t('lifePage.title')}</h2>
      {seen.isPending ? <SkeletonList count={4} label={t('lifePage.loading')} />
        : !count ? (
          <p className='life-page__empty'><Trans i18nKey='lifePage.empty' components={{ settings: <Link to='/settings' /> }} /></p>
        ) : (
          <>
            <div className='life-page__tools'>
              <div className='life-page__search'>
                <SearchIcon className='life-page__search-icon' />
                <input type='search' placeholder={t('lifePage.search')} aria-label={t('lifePage.search')} autoComplete='off' value={search} onChange={(e) => setSearch(e.target.value)} />
                {search && <button type='button' className='life-page__clear' aria-label={t('common.clearSearch')} onClick={() => setSearch('')}><CloseIcon /></button>}
              </div>
              <label className='life-page__sort'>
                <span>{t('lifePage.sort')}</span>
                <select className='select' value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value='newest'>{t('lifePage.newest')}</option>
                  <option value='name'>{t('lifePage.az')}</option>
                  <option value='taxonomic'>{t('lifePage.taxonomic')}</option>
                </select>
              </label>
            </div>
            {codes && !codes.length && <p className='life-page__empty'>{t('lifePage.noMatch', { text: search.trim() })}</p>}
            {pages.isPending && codes && codes.length > 0 ? <SkeletonList count={4} label={t('loading.birds')} /> : <BirdsList birds={birds} />}
            <div ref={sentinelRef} className='list-sentinel' aria-hidden='true'></div>
            {pages.isFetchingNextPage && <p className='list-end'>{t('common.loadingMore')}</p>}
            {!pages.hasNextPage && birds.length > 0 && <p className='list-end'>{term ? t('lifePage.endMatching', { count: birds.length }) : t('lifePage.end', { count })}</p>}
          </>
        )}
    </section>
  )
}

export default LifeListPage
