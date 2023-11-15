import { useContext, useState, useEffect } from "react"
import PropTypes from "prop-types"
import './Card.css'
import BirdsContext from "../BirdsContext/BirdsContext"
import { postSavedBird, deleteSavedBird, isBirdSaved } from "../../apiCalls"

const Card = ({ bird }) => {
    const { birds, setBirds, user } = useContext(BirdsContext)
    const [isChecked, setIsChecked] = useState(false)

    useEffect(() => {
        const checkSavedStatus = async () => {
            const saved = await isBirdSaved(bird)
            setIsChecked(saved)
        };
        checkSavedStatus();
    }, [bird])

    const handleClick = async () => {
        try {
            if (isChecked) {
                await deleteSavedBird(bird, user.id)
            } else {
                await postSavedBird(bird, user.id)
            }

            const updatedBirds = birds.map(b => {
                if (b.speciesCode === bird.speciesCode) {
                    return { ...b, isChecked: !isChecked }
                }
                return b
            })
            setBirds(updatedBirds)
        } catch (error) {
            console.error("API call error:", error)
        } finally {
            setIsChecked(!isChecked)
        }
    };

    return (
        <div className='card'>
            <img className='bird-img' src={bird.birdImg || process.env.PUBLIC_URL + 'images/noBirdImg.png'} alt={`a ${bird.comName}`}/>
            <div className='bird-details'>
                <p>{bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
            </div>
            <input type="checkbox" checked={isChecked} id={bird.speciesCode} name={bird.comName} value={bird.isChecked} onChange={handleClick} />
        </div>
    )
}

export default Card

Card.propTypes = {
    bird: PropTypes.object.isRequired
}
