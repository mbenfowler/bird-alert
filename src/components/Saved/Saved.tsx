import { useMemo, useState } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import ListTabs from '../ListTabs/ListTabs'
import ErrorMessage from '../Error/ErrorMessage'
import { SkeletonList } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useObservationsQuery, useSavedBirdsQuery, useSeenCodes } from '../../hooks/queries'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import './Saved.css'

const STEP = 12
const HIDE_SEEN_KEY = 'bird-alert:hide-seen'
const readHideSeen = () => { try { return localStorage.getItem(HIDE_SEEN_KEY) === '1' } catch { return false } }

const Saved = () => {
    const user = useCurrentUser()
    const saved = useSavedBirdsQuery()
    // Birds already on the life list can be put out of the way, leaving the ones still to find.
    const seen = useSeenCodes()
    const [hideSeen, setHideSeenState] = useState(readHideSeen)
    const setHideSeen = (on: boolean) => { setHideSeenState(on); try { localStorage.setItem(HIDE_SEEN_KEY, on ? '1' : '0') } catch { /* this visit only */ } }
    const allSaved = useMemo(() => saved.data ?? [], [saved.data])
    const seenCount = useMemo(() => allSaved.filter(b => seen.codes.has(b.speciesCode)).length, [allSaved, seen.codes])
    const savedBirds = useMemo(() => hideSeen ? allSaved.filter(b => !seen.codes.has(b.speciesCode)) : allSaved, [allSaved, hideSeen, seen.codes])

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
            <ListTabs lifeCount={seen.codes.size} />
            <h2 className='fredericka list-heading'>Birds on your watch list</h2>
            {seenCount > 0 && (
                <label className='list-filter'>
                    <input className='switch switch--small' type='checkbox' checked={hideSeen} onChange={(e) => { setHideSeen(e.target.checked); setLimit(STEP) }} />
                    Hide the {seenCount} I’ve seen
                </label>
            )}
            {saved.isPending
                ? <SkeletonList count={4} label='Loading your watch list…' />
                : savedBirds.length
                    ? <>
                        <BirdsList birds={visible} />
                        <div ref={sentinelRef} className='list-sentinel' aria-hidden='true'></div>
                        {hasMore
                            ? <button type='button' className='load-more' onClick={() => setLimit(current => current + STEP)}>Show more ({visible.length} of {savedBirds.length})</button>
                            : <p className='list-end'>{savedBirds.length} bird{savedBirds.length === 1 ? '' : 's'} on your watch list{hideSeen ? ' you haven’t seen yet' : ''}.</p>}
                      </>
                    : hideSeen && allSaved.length
                        ? <p className='list-end'>You’ve seen every bird on your watch list.</p>
                        : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
