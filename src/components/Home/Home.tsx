import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import BirdAlerts from '../BirdAlerts/BirdAlerts'
import BirdsList from '../BirdsList/BirdsList'
import ErrorMessage from '../Error/ErrorMessage'
import { errorMessage } from '../../apiCalls'
import { birdsQueryOptions, SEARCH_MIN_LENGTH, useBirdSearchQuery, useBirdsQuery, useCurrentUser, useSpeciesListQuery } from '../../hooks/queries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePageParam } from '../../hooks/usePageParam'
import './Home.css'

const RESULTS_PER_PAGE = 5
const SEARCH_DEBOUNCE_MS = 250

const Home = () => {
    const user = useCurrentUser()
    const region = user.location
    const queryClient = useQueryClient()

    // The region's species list is cached for a day; pages are slices of it.
    const speciesList = useSpeciesListQuery(region)
    const codes = useMemo(() => speciesList.data ?? [], [speciesList.data])
    const pageCount = Math.max(1, Math.ceil(codes.length / RESULTS_PER_PAGE))
    const [page, setPage] = usePageParam(pageCount)
    const pageCodes = useMemo(() => codes.slice((page - 1) * RESULTS_PER_PAGE, page * RESULTS_PER_PAGE), [codes, page])
    const nextPageCodes = useMemo(() => codes.slice(page * RESULTS_PER_PAGE, (page + 1) * RESULTS_PER_PAGE), [codes, page])

    const birds = useBirdsQuery(pageCodes)

    // Warm the next page so flipping forward is instant.
    useEffect(() => {
        if (nextPageCodes.length) void queryClient.prefetchQuery(birdsQueryOptions(nextPageCodes))
    }, [nextPageCodes, queryClient])

    const [search, setSearch] = useState('')
    const rawTerm = search.trim()
    const term = useDebouncedValue(rawTerm, SEARCH_DEBOUNCE_MS)
    const isSearching = rawTerm.length > 0
    const results = useBirdSearchQuery(term)

    const renderBirds = () => {
        if (!isSearching) {
            if (speciesList.isError) return <ErrorMessage networkError={errorMessage(speciesList.error)} />
            if (birds.isError) return <ErrorMessage networkError={errorMessage(birds.error)} />
            if (speciesList.isPending || (pageCodes.length > 0 && !birds.data)) return <div className='spinner'></div>
            return (
                <>
                    <h2 className='fredericka'>Birds in your area:</h2>
                    <div className={birds.isPlaceholderData ? 'is-stale' : undefined}>
                        <BirdsList birds={birds.data ?? []} />
                    </div>
                </>
            )
        }
        if (rawTerm.length < SEARCH_MIN_LENGTH) return <h3 className='fredericka'>Keep typing to search</h3>
        if (results.isError) return <ErrorMessage networkError={errorMessage(results.error)} />
        if (!results.data) return <div className='spinner'></div>
        if (!results.data.length) return <h3 className='fredericka'>No birds found</h3>
        return <><h2 className='note fredericka'>Note: these birds may not be common to your area</h2><BirdsList birds={results.data} /></>
    }

    const showPagination = !isSearching && speciesList.isSuccess && Boolean(birds.data)

    return (
        <>
            <section id='alertArea'>
                <BirdAlerts />
            </section>
            <section id='birdsInArea'>
                <input id='birdSearch' type="search" placeholder='Search birds by name' aria-label='Search birds by name' value={search} onChange={(e) => setSearch(e.target.value)} />
                {renderBirds()}
            </section>
            {showPagination &&
                <div className='pagination'>
                    {page !== 1 && <button className='pagination-btn' onClick={() => setPage(page - 1)}>&lt;</button>}
                    <p>{`Page ${page} of ${pageCount}`}</p>
                    {page !== pageCount && <button className='pagination-btn' onClick={() => setPage(page + 1)}>&gt;</button>}
                </div>
            }
        </>
    )
}

export default Home
