import { toast } from 'react-toastify'
import './Card.css'
import { errorMessage } from '../../apiCalls'
import { useSavedCodes } from '../../hooks/queries'
import { useToggleSavedMutation } from '../../hooks/mutations'
import type { Bird } from '../../types'

interface CardProps {
    bird: Bird
}

const Card = ({ bird }: CardProps) => {
    const savedCodes = useSavedCodes()
    const toggleSaved = useToggleSavedMutation()

    // Checked state comes straight from the watch list, so every card agrees with the saved view.
    const isChecked = savedCodes.has(bird.speciesCode)

    const handleChange = () => {
        const save = !isChecked
        toggleSaved.mutate({ bird, save }, {
            onSuccess: () => toast.success(save ? 'Bird saved to watch list!' : 'Bird removed from watch list!', { position: 'bottom-center' }),
            onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
        })
    }

    const img = bird.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : '/images/noBirdImg.png'

    return (
        <div className='card'>
            <img className='bird-img' src={img} alt={`a ${bird.comName}`} loading='lazy' width='200' height='150' />
            <div className='bird-details'>
                <p>{bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
                <p className='last-observed'>
                    {bird.lastObserved && (
                        <>
                            Last observed nearby: <br />
                            {bird.lastObserved}
                        </>
                    )}
                </p>
            </div>
            <input type="checkbox" checked={isChecked} disabled={toggleSaved.isPending} id={bird.speciesCode} name={bird.comName} aria-label={`Watch ${bird.comName}`} onChange={handleChange} />
        </div>
    )
}

export default Card
