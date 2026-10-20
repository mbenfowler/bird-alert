import { useMemo, useState } from 'react'
import BirdAlerts from '../BirdAlerts/BirdAlerts'
import BirdsList from '../BirdsList/BirdsList'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState, SkeletonList } from '../Loading/Loading'
import { SearchIcon, CloseIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { SEARCH_MIN_LENGTH, useBirdSearchQuery, useCurrentUser, useInfiniteBirdsQuery, useSpeciesListQuery } from '../../hooks/queries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import './Home.css'

const PAGE_SIZE = 12
const SEARCH_DEBOUNCE_MS = 250

const Home = () => {
    const user = useCurrentUser()
    const region = user.location

    const speciesList = useSpeciesListQuery(region)
    const codes = useMemo(() => speciesList.data ?? [], [speciesList.data])
    const birdPages = useInfiniteBirdsQuery(region, codes, PAGE_SIZE)
    const birds = useMemo(() => birdPages.data?.pages.flat() ?? [], [birdPages.data])

    const loadMore = () => { if (birdPages.hasNextPage && !birdPages.isFetchingNextPage) void birdPages.fetchNextPage() }
    const sentinelRef = useInfiniteScroll(loadMore, Boolean(birdPages.hasNextPage) && !birdPages.isFetchingNextPage)

    const [search, setSearch] = useState('')
    const rawTerm = search.trim()
    const term = useDebouncedValue(rawTerm, SEARCH_DEBOUNCE_MS)
    const isSearching = rawTerm.length > 0
    const results = useBirdSearchQuery(term)

    const renderSearch = () => {
        if (rawTerm.length < SEARCH_MIN_LENGTH) return <p className='list-note'>Keep typing to search every bird we know about.</p>
        if (results.isError) return <ErrorMessage networkError={errorMessage(results.error)} />
        if (!results.data) return <SkeletonList count={3} label='Searching…' />
        if (!results.data.length) return <p className='list-note'>No birds match "{rawTerm}".</p>
        return (
            <>
                <p className='list-note'>{results.data.length} match{results.data.length === 1 ? '' : 'es'}. These may not be common to your area.</p>
                <BirdsList birds={results.data} />
            </>
        )
    }

    const renderBirds = () => {
        if (speciesList.isError) return <ErrorMessage networkError={errorMessage(speciesList.error)} />
        if (birdPages.isError) return <ErrorMessage networkError={errorMessage(birdPages.error)} />
        if (speciesList.isPending || (codes.length > 0 && birdPages.isPending)) return <SkeletonList count={6} />
        if (!codes.length) return <p className='list-note'>eBird has no species recorded for this region yet.</p>
        return (
            <>
                <BirdsList birds={birds} />
                {birdPages.isFetchingNextPage && <SkeletonList count={3} label='Loading more birds…' />}
                <div ref={sentinelRef} className='list-sentinel' aria-hidden='true'></div>
                {birdPages.hasNextPage
                    ? <button type='button' className='load-more' onClick={loadMore} disabled={birdPages.isFetchingNextPage}>
                        {birdPages.isFetchingNextPage ? <LoadingState variant='inline' label='Loading more birds' /> : `Show more (${birds.length} of ${codes.length})`}
                      </button>
                    : <p className='list-end'>That's all {codes.length} birds reported in your area.</p>}
            </>
        )
    }

    return (
        <>
            <section id='alertArea'>
                <BirdAlerts />
            </section>
            <section id='birdsInArea'>
                <div className='search'>
                    <SearchIcon className='search__icon' />
                    <input id='birdSearch' type='search' placeholder='Search birds by name' aria-label='Search birds by name' autoComplete='off' value={search} onChange={(e) => setSearch(e.target.value)} />
                    {search && <button type='button' className='search__clear' aria-label='Clear search' onClick={() => setSearch('')}><CloseIcon /></button>}
                </div>
                <h2 className='fredericka list-heading'>{isSearching ? 'Search results' : 'Birds in your area'}</h2>
                {isSearching ? renderSearch() : renderBirds()}
            </section>
        </>
    )
}

export default Home
