import { useState, useEffect } from 'react'
import BirdAlerts from '../BirdAlerts/BirdAlerts'
import BirdsList from '../BirdsList/BirdsList'
import { useBirds } from '../BirdsContext/BirdsContext'
import { searchBirds } from '../../apiCalls'
import type { Bird } from '../../types'
import './Home.css'

const SEARCH_MIN_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 250

const Home = () => {
    const { birds, currentPage, setCurrentPage, pageCount, isLoaded } = useBirds()
    const [search, setSearch] = useState('')
    const [searchedBirds, setSearchedBirds] = useState<Bird[]>([])
    const [isSearchLoading, setIsSearchLoading] = useState(false)

    const term = search.trim()
    const isSearching = term.length > 0
    const canSearch = term.length >= SEARCH_MIN_LENGTH

    // Debounced name search against birds we already know about.
    useEffect(() => {
        if (!canSearch) {
            setSearchedBirds([])
            setIsSearchLoading(false)
            return
        }
        let cancelled = false
        setIsSearchLoading(true)
        const timer = setTimeout(async () => {
            try {
                const results = await searchBirds(term)
                if (!cancelled) setSearchedBirds(results)
            } catch {
                if (!cancelled) setSearchedBirds([])
            } finally {
                if (!cancelled) setIsSearchLoading(false)
            }
        }, SEARCH_DEBOUNCE_MS)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [term, canSearch])

    const renderBirds = () => {
        if (!isSearching) {
            return isLoaded
                ? <><h2 className='fredericka'>Birds in your area:</h2> <BirdsList birds={birds} /></>
                : <div className='spinner'></div>
        }
        if (!canSearch) return <h3 className='fredericka'>Keep typing to search</h3>
        if (isSearchLoading) return <div className='spinner'></div>
        if (!searchedBirds.length) return <h3 className='fredericka'>No birds found</h3>
        return <><h2 className='note fredericka'>Note: these birds may not be common to your area</h2><BirdsList birds={searchedBirds} /></>
    }

    return (
        <>
            <section id='alertArea'>
                <BirdAlerts />
            </section>
            <section id='birdsInArea'>
                <input id='birdSearch' type="search" placeholder='Search birds by name' value={search} onChange={(e) => setSearch(e.target.value)} />
                {renderBirds()}
            </section>
            {isLoaded && !isSearching &&
                <div className='pagination'>
                    {currentPage !== 1 && <button className='pagination-btn' onClick={() => setCurrentPage(currentPage - 1)}>&lt;</button>}
                    <p>{`Page ${currentPage} of ${pageCount}`}</p>
                    {currentPage !== pageCount && <button className='pagination-btn' onClick={() => setCurrentPage(currentPage + 1)}>&gt;</button>}
                </div>
            }
        </>
    )
}

export default Home
