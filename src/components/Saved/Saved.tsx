import { useMemo } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import ErrorMessage from '../Error/ErrorMessage'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useObservationsQuery, useSavedBirdsQuery } from '../../hooks/queries'
import { usePageParam } from '../../hooks/usePageParam'
import './Saved.css'

const RESULTS_PER_PAGE = 5

const Saved = () => {
    const user = useCurrentUser()
    const saved = useSavedBirdsQuery()
    const savedBirds = useMemo(() => saved.data ?? [], [saved.data])

    // Removing a bird can shrink the list; the page param is clamped so we never point past the end.
    const pageCount = Math.max(1, Math.ceil(savedBirds.length / RESULTS_PER_PAGE))
    const [page, setPage] = usePageParam(pageCount)
    const pageBirds = useMemo(
        () => savedBirds.slice((page - 1) * RESULTS_PER_PAGE, page * RESULTS_PER_PAGE),
        [savedBirds, page]
    )

    // Latest nearby sighting per species, from the region observations the home page already caches.
    // eBird returns them newest first, so the first match per species wins.
    const observations = useObservationsQuery(user.location)
    const latestByCode = useMemo(() => {
        const map = new Map<string, string>()
        for (const obs of observations.data ?? []) if (!map.has(obs.speciesCode)) map.set(obs.speciesCode, obs.obsDt)
        return map
    }, [observations.data])
    const birdsWithLastObserved = pageBirds.map(bird => ({ ...bird, lastObserved: latestByCode.get(bird.speciesCode) }))

    if (saved.isError) return <ErrorMessage networkError={errorMessage(saved.error)} />
    if (saved.isPending) return <div className='spinner'></div>

    return (
        <section id='birdsInArea'>
            <h2>Birds on your watch list:</h2>
            {savedBirds.length
                ? <>
                    <BirdsList birds={birdsWithLastObserved} />
                    <div className='pagination'>
                        {page !== 1 && <button className='pagination-btn' onClick={() => setPage(page - 1)}>&lt;</button>}
                        <p>{`Page ${page} of ${pageCount}`}</p>
                        {page !== pageCount && <button className='pagination-btn' onClick={() => setPage(page + 1)}>&gt;</button>}
                    </div>
                  </>
                : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
