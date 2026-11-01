import type { ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import './Card.css'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage, postSeenBird } from '../../apiCalls'
import { queryKeys, useSavedCodes, useSeenCodes } from '../../hooks/queries'
import { useToggleSavedMutation, useToggleSeenMutation } from '../../hooks/mutations'
import type { Bird } from '../../types'
import { SoundCredit, SoundToggle } from '../SoundButton/SoundButton'
import { useBirdSound } from '../../hooks/useBirdSound'
import { celebrateLifer, popStar } from '../Pop/pop'
import { offerPush } from '../../pushAsk'
import { monthDayYear, t } from '../../i18n'

interface CardProps {
    bird: Bird
}

const Card = ({ bird }: CardProps) => {
    const savedCodes = useSavedCodes()
    const toggleSaved = useToggleSavedMutation()
    const sound = useBirdSound(bird.speciesCode, bird.comName)
    const seen = useSeenCodes()
    const toggleSeen = useToggleSeenMutation()
    const queryClient = useQueryClient()
    const isSeen = seen.codes.has(bird.speciesCode)

    // Checked state comes straight from the watch list, so every card agrees with the saved view.
    const isChecked = savedCodes.has(bird.speciesCode)

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const save = !isChecked
        popStar(event.currentTarget, save)
        toggleSaved.mutate({ bird, save }, {
            // Saving may be the moment to offer alerts on this device; the ask replaces the toast when it shows.
            onSuccess: () => { void (save ? offerPush(bird.comName) : Promise.resolve(false)).then((asked) => { if (!asked) toast.success(save ? t('watch.saved') : t('watch.removed'), { position: 'bottom-center' }) }) },
            onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
        })
    }

    const img = bird.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : '/images/noBirdImg.png'

    const body = (
        <>
            <img className='bird-img' src={img} alt={t('card.photoAlt', { name: bird.comName })} loading='lazy' width='200' height='150' />
            <div className='bird-details'>
                <p>{bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
                <p className='last-observed'>
                    {bird.firstSeen !== undefined ? (bird.firstSeen && (
                        <>
                            {t('card.firstSeen')} <br />
                            {monthDayYear(bird.firstSeen)}
                        </>
                    )) : bird.lastObserved && (
                        <>
                            {t('card.lastObserved')} <br />
                            {bird.lastObserved}
                        </>
                    )}
                </p>
                {(sound.state === 'playing' || sound.state === 'paused') && <SoundCredit sound={sound.sound} className='card-sound-credit' />}
            </div>
        </>
    )

    // The link wraps only the picture and names, so the checkbox is never nested inside an anchor.
    return (
        <article className='card'>
            {bird.wikiURL
                ? <a className='card-link' href={bird.wikiURL} target='_blank' rel='noreferrer'>{body}<span className='visually-hidden'>{t('card.wikiHidden')}</span></a>
                : <div className='card-link'>{body}</div>}
            {/* The life list: the star's twin at the other corner, a tick for a bird you've seen. */}
            <input type="checkbox" className='card-seen' checked={isSeen} disabled={!seen.loaded} id={`seen-${bird.speciesCode}`} aria-label={t('card.seen', { name: bird.comName })} title={isSeen ? t('card.onLifeList') : t('card.addLifeList')}
                onChange={(event) => {
                    const seenNow = !isSeen
                    toggleSeen.mutate({ speciesCode: bird.speciesCode, seen: seenNow }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
                    // Taking a bird off the life list is easy to do by accident; offer it back. Said at
                    // once, and undone without this card, which the life list page drops straight away.
                    if (seenNow) celebrateLifer(event.currentTarget, bird.comName)
                    else toast(({ closeToast }) => (
                        <span className='toast-undo'>{t('card.removedLife', { name: bird.comName })} <button type='button' onClick={() => { void postSeenBird(bird.speciesCode).finally(() => queryClient.invalidateQueries({ queryKey: queryKeys.seen })); closeToast() }}>{t('card.undo')}</button></span>
                    ), { position: 'bottom-center' })
                }} />
            <input type="checkbox" checked={isChecked} disabled={toggleSaved.isPending} id={bird.speciesCode} name={bird.comName} aria-label={t('arrival.watch', { name: bird.comName })} onChange={handleChange} />
            <SoundToggle state={sound.state} name={bird.comName} onToggle={() => { void sound.toggle() }} className='card-sound' />
        </article>
    )
}

export default Card
