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
            onSuccess: () => toast.success(save ? 'Bird saved to watch list!' : 'Bird removed from watch list!', { position: 'bottom-center' }),
            onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
        })
    }

    const img = bird.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : '/images/noBirdImg.png'

    const body = (
        <>
            <img className='bird-img' src={img} alt={`a ${bird.comName}`} loading='lazy' width='200' height='150' />
            <div className='bird-details'>
                <p>{bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
                <p className='last-observed'>
                    {bird.firstSeen !== undefined ? (bird.firstSeen && (
                        <>
                            First seen: <br />
                            {new Date(`${bird.firstSeen}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </>
                    )) : bird.lastObserved && (
                        <>
                            Last observed nearby: <br />
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
                ? <a className='card-link' href={bird.wikiURL} target='_blank' rel='noreferrer'>{body}<span className='visually-hidden'>, read about this bird on Wikipedia (opens in a new tab)</span></a>
                : <div className='card-link'>{body}</div>}
            {/* The life list: the star's twin at the other corner, a tick for a bird you've seen. */}
            <input type="checkbox" className='card-seen' checked={isSeen} disabled={!seen.loaded} id={`seen-${bird.speciesCode}`} aria-label={`Seen ${bird.comName}`} title={isSeen ? 'On your life list' : 'Seen it? Add to your life list'}
                onChange={(event) => {
                    const seenNow = !isSeen
                    toggleSeen.mutate({ speciesCode: bird.speciesCode, seen: seenNow }, { onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' }) })
                    // Taking a bird off the life list is easy to do by accident; offer it back. Said at
                    // once, and undone without this card, which the life list page drops straight away.
                    if (seenNow) celebrateLifer(event.currentTarget, bird.comName)
                    else toast(({ closeToast }) => (
                        <span className='toast-undo'>Removed {bird.comName} from your life list <button type='button' onClick={() => { void postSeenBird(bird.speciesCode).finally(() => queryClient.invalidateQueries({ queryKey: queryKeys.seen })); closeToast() }}>Undo</button></span>
                    ), { position: 'bottom-center' })
                }} />
            <input type="checkbox" checked={isChecked} disabled={toggleSaved.isPending} id={bird.speciesCode} name={bird.comName} aria-label={`Watch ${bird.comName}`} onChange={handleChange} />
            <SoundToggle state={sound.state} name={bird.comName} onToggle={() => { void sound.toggle() }} className='card-sound' />
        </article>
    )
}

export default Card
