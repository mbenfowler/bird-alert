import { useEffect, useMemo, useState } from 'react'
import BirdAlerts from '../BirdAlerts/BirdAlerts'
import BirdsList from '../BirdsList/BirdsList'
import ErrorMessage from '../Error/ErrorMessage'
import { LoadingState, SkeletonList } from '../Loading/Loading'
import { SearchIcon, CloseIcon } from '../Icons/Icons'
import { errorMessage } from '../../apiCalls'
import { SEARCH_MIN_LENGTH, useBirdSearchQuery, useCurrentUser, useInfiniteBirdsQuery, useRegionsQuery, useSpeciesListQuery } from '../../hooks/queries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import './Home.css'

const PAGE_SIZE = 12
const REGION_ONLY_KEY = 'bird-alert-search-region-only'

const readRegionOnly = () => { try { return localStorage.getItem(REGION_ONLY_KEY) === '1' } catch { return false } }
const writeRegionOnly = (value: boolean) => { try { localStorage.setItem(REGION_ONLY_KEY, value ? '1' : '0') } catch { /* private mode etc. */ } }
const SEARCH_DEBOUNCE_MS = 250

const Home = () => {
    const user = useCurrentUser()
    const region = user.location

    // "Hall - US-GA-139": the same label the settings page shows for the chosen region.
    const regions = useRegionsQuery(user.state)
    const regionName = regions.data?.find(r => r.code === region)?.name
    const regionLabel = regionName ? `${regionName} - ${region}` : region

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

    // Search covers every bird we know about; this narrows it to the region's species list.
    // The choice is a per-device convenience, remembered in localStorage.
    const [regionOnly, setRegionOnly] = useState(() => readRegionOnly())
    useEffect(() => { writeRegionOnly(regionOnly) }, [regionOnly])
    const regionCodes = useMemo(() => new Set(codes), [codes])
    const allResults = useMemo(() => results.data ?? [], [results.data])
    const inRegion = useMemo(() => allResults.filter(bird => regionCodes.has(bird.speciesCode)), [allResults, regionCodes])
    const shownResults = regionOnly ? inRegion : allResults

    const renderSearch = () => {
        if (rawTerm.length < SEARCH_MIN_LENGTH) return <p className='list-note'>Keep typing to search {regionOnly ? `birds in ${regionName ?? 'your region'}` : 'every bird we know about'}.</p>
        if (results.isError) return <ErrorMessage networkError={errorMessage(results.error)} />
        if (!results.data) return <SkeletonList count={3} label='Searching…' />
        if (!shownResults.length) {
            return (
                <p className='list-note'>
                    {regionOnly && allResults.length
                        ? <>No birds in {regionName ?? 'your region'} match "{rawTerm}". {allResults.length} match elsewhere: <button type='button' className='link-button list-note__link' onClick={() => setRegionOnly(false)}>show all birds</button>.</>
                        : <>No birds match "{rawTerm}".</>}
                </p>
            )
        }
        return (
            <>
                <p className='list-note'>
                    {regionOnly
                        ? `${shownResults.length} match${shownResults.length === 1 ? '' : 'es'} in ${regionName ?? 'your region'}${allResults.length > shownResults.length ? `, ${allResults.length - shownResults.length} more elsewhere` : ''}.`
                        : `${shownResults.length} match${shownResults.length === 1 ? '' : 'es'}. ${inRegion.length} of them ${inRegion.length === 1 ? 'is' : 'are'} in your area.`}
                </p>
                <BirdsList birds={shownResults} />
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
                <label className='search-scope'>
                    <input className='switch switch--small' type='checkbox' id='searchRegionOnly' checked={regionOnly} onChange={(e) => setRegionOnly(e.target.checked)} />
                    <span>Only birds in {regionName ?? 'my region'}</span>
                </label>
                <h2 className='fredericka list-heading'>
                    {isSearching ? 'Search results' : <>Birds in your area: <span className='list-heading__region'>{regionLabel}</span></>}
                </h2>
                {isSearching ? renderSearch() : renderBirds()}
            </section>
        </>
    )
}

export default Home
