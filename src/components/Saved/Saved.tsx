import { useMemo, useState } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import ErrorMessage from '../Error/ErrorMessage'
import { SkeletonList } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useObservationsQuery, useSavedBirdsQuery } from '../../hooks/queries'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import './Saved.css'

const STEP = 12

const Saved = () => {
    const user = useCurrentUser()
    const saved = useSavedBirdsQuery()
    const savedBirds = useMemo(() => saved.data ?? [], [saved.data])

    // The whole list is already in memory; reveal it a screen at a time to keep the first paint light.
    const [limit, setLimit] = useState(STEP)
    const hasMore = limit < savedBirds.length
    const sentinelRef = useInfiniteScroll(() => setLimit(current => current + STEP), hasMore)

    // Latest nearby sighting per species, from the region observations the home page already caches.
    const observations = useObservationsQuery(user.location)
    const latestByCode = useMemo(() => {
        const map = new Map<string, string>()
        for (const obs of observations.data ?? []) if (!map.has(obs.speciesCode)) map.set(obs.speciesCode, obs.obsDt)
        return map
    }, [observations.data])
    const visible = useMemo(
        () => savedBirds.slice(0, limit).map(bird => ({ ...bird, lastObserved: latestByCode.get(bird.speciesCode) })),
        [savedBirds, limit, latestByCode]
    )

    if (saved.isError) return <ErrorMessage networkError={errorMessage(saved.error)} />

    return (
        <section id='birdsInArea'>
            <h2 className='fredericka list-heading'>Birds on your watch list</h2>
            {saved.isPending
                ? <SkeletonList count={4} label='Loading your watch list…' />
                : savedBirds.length
                    ? <>
                        <BirdsList birds={visible} />
                        <div ref={sentinelRef} className='list-sentinel' aria-hidden='true'></div>
                        {hasMore
                            ? <button type='button' className='load-more' onClick={() => setLimit(current => current + STEP)}>Show more ({visible.length} of {savedBirds.length})</button>
                            : <p className='list-end'>{savedBirds.length} bird{savedBirds.length === 1 ? '' : 's'} on your watch list.</p>}
                      </>
                    : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
