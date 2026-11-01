import { useMemo, useState } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import ListTabs from '../ListTabs/ListTabs'
import ErrorMessage from '../Error/ErrorMessage'
import { SkeletonList } from '../Loading/Loading'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useObservationsQuery, useSavedBirdsQuery, useSeenCodes } from '../../hooks/queries'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import './Saved.css'
import { t } from '../../i18n'

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
            <h2 className='fredericka list-heading'>{t('saved.title')}</h2>
            {seenCount > 0 && (
                <label className='list-filter'>
                    <input className='switch switch--small' type='checkbox' checked={hideSeen} onChange={(e) => { setHideSeen(e.target.checked); setLimit(STEP) }} />
                    {t('saved.hideSeen', { count: seenCount })}
                </label>
            )}
            {saved.isPending
                ? <SkeletonList count={4} label={t('saved.loading')} />
                : savedBirds.length
                    ? <>
                        <BirdsList birds={visible} />
                        <div ref={sentinelRef} className='list-sentinel' aria-hidden='true'></div>
                        {hasMore
                            ? <button type='button' className='load-more' onClick={() => setLimit(current => current + STEP)}>{t('common.showMore', { shown: visible.length, count: savedBirds.length })}</button>
                            : <p className='list-end'>{hideSeen ? t('saved.endUnseen', { count: savedBirds.length }) : t('saved.end', { count: savedBirds.length })}</p>}
                      </>
                    : hideSeen && allSaved.length
                        ? <p className='list-end'>{t('saved.allSeen')}</p>
                        : <p className='info-text'>{t('saved.empty')}</p>}
        </section>
    )
}

export default Saved
