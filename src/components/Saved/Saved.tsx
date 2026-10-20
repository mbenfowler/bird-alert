import { useState, useEffect, useMemo } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import { useBirds, useCurrentUser } from '../BirdsContext/BirdsContext'
import { getSavedBirds, getExternalLastObserved } from '../../apiCalls'
import type { Bird } from '../../types'
import './Saved.css'

const RESULTS_PER_PAGE = 5

const Saved = () => {
    const user = useCurrentUser()
    const { savedBirds, setSavedBirds, handleNetworkErrors } = useBirds()
    const [requestedPage, setRequestedPage] = useState(1)
    const [birdsWithLastObserved, setBirdsWithLastObserved] = useState<Bird[]>([])

    // Refresh the watch list when the view opens.
    useEffect(() => {
        let cancelled = false
        getSavedBirds()
            .then(saved => { if (!cancelled) setSavedBirds(saved) })
            .catch(error => { if (!cancelled) handleNetworkErrors(error) })
        return () => { cancelled = true }
    }, [setSavedBirds, handleNetworkErrors])

    // Removing a bird can shrink the list, so never point past the last page.
    const pageCount = Math.max(1, Math.ceil(savedBirds.length / RESULTS_PER_PAGE))
    const currentPage = Math.min(requestedPage, pageCount)

    const pageBirds = useMemo(() => {
        const start = (currentPage - 1) * RESULTS_PER_PAGE
        return savedBirds.slice(start, start + RESULTS_PER_PAGE)
    }, [savedBirds, currentPage])

    // Decorate the visible page with each bird's latest nearby sighting.
    const region = user.location
    useEffect(() => {
        let cancelled = false
        setBirdsWithLastObserved(pageBirds)
        if (!region || !pageBirds.length) return
        Promise.all(pageBirds.map(async (bird): Promise<Bird> => {
            try {
                const observations = await getExternalLastObserved(bird.speciesCode, region)
                return { ...bird, lastObserved: observations[0]?.obsDt }
            } catch {
                return bird
            }
        })).then(result => { if (!cancelled) setBirdsWithLastObserved(result) })
        return () => { cancelled = true }
    }, [pageBirds, region])

    return (
        <section id='birdsInArea'>
            <h2>Birds on your watch list:</h2>
            {savedBirds.length
                ? <>
                    <BirdsList birds={birdsWithLastObserved} />
                    <div className='pagination'>
                        {currentPage !== 1 && <button className='pagination-btn' onClick={() => setRequestedPage(currentPage - 1)}>&lt;</button>}
                        <p>{`Page ${currentPage} of ${pageCount}`}</p>
                        {currentPage !== pageCount && <button className='pagination-btn' onClick={() => setRequestedPage(currentPage + 1)}>&gt;</button>}
                    </div>
                  </>
                : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
