import { useContext, useState } from "react"
import { toast } from 'react-toastify'
import PropTypes from "prop-types"
import './Card.css'
import BirdsContext from "../BirdsContext/BirdsContext"
import { postSavedBird, deleteSavedBird } from "../../apiCalls"

const Card = ({ bird }) => {
    const { savedCodes, setSavedBirds } = useContext(BirdsContext)
    const [isPending, setIsPending] = useState(false)

    // Checked state comes straight from the watch list, so every card agrees with the saved view.
    const isChecked = savedCodes.has(bird.speciesCode)

    const handleChange = async () => {
        setIsPending(true)
        try {
            if (isChecked) {
                await deleteSavedBird(bird.speciesCode)
                setSavedBirds(prev => prev.filter(saved => saved.speciesCode !== bird.speciesCode))
                toast.success('Bird removed from watch list!', { position: 'bottom-center' })
            } else {
                const saved = await postSavedBird(bird)
                setSavedBirds(prev => (prev.some(b => b.speciesCode === saved.speciesCode) ? prev : [...prev, saved]))
                toast.success('Bird saved to watch list!', { position: 'bottom-center' })
            }
        } catch (error) {
            toast.error(error.message, { position: 'bottom-center' })
        } finally {
            setIsPending(false)
        }
    }

    const img = bird.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : 'images/noBirdImg.png'

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
            <input type="checkbox" checked={isChecked} disabled={isPending} id={bird.speciesCode} name={bird.comName} aria-label={`Watch ${bird.comName}`} onChange={handleChange} />
        </div>
    )
}

export default Card

Card.propTypes = {
    bird: PropTypes.shape({
        speciesCode: PropTypes.string.isRequired,
        comName: PropTypes.string.isRequired,
        sciName: PropTypes.string.isRequired,
        birdImg: PropTypes.string,
        wikiURL: PropTypes.string,
        lastObserved: PropTypes.string
    }).isRequired
}
