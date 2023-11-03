import { useContext, useState, useEffect } from "react"
import PropTypes from "prop-types"
import './Card.css'
import BirdsContext from "../BirdsContext/BirdsContext"
import { postSavedBird, deleteSavedBird } from "../../apiCalls"

const Card = ({ bird, saved }) => {
    const { birds, setBirds } = useContext(BirdsContext)
    const [isChecked, setIsChecked] = useState(saved)

    useEffect(() => {
        setIsChecked(saved);
    }, []);

    const handleClick = () => {
        setIsChecked(!isChecked);

        const updatedBirds = birds.map(b => {
            if (b.speciesCode === bird.speciesCode) {
                return { ...b, isChecked: !isChecked };
            }
            return b;
        });

        setBirds(updatedBirds);

        if (isChecked) {
            deleteSavedBird(bird);
        } else {
            postSavedBird(bird);
        }
    };

    console.log('isChecked', isChecked)

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
