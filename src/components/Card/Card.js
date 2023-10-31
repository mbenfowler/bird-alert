import { useState, useContext } from "react"
import PropTypes from "prop-types"
import './Card.css'
import BirdsContext from "../BirdsContext/BirdsContext"

const Card = ({ bird }) => {
    const { birds, setBirds } = useContext(BirdsContext)
    const [isToggled, setIsToggled] = useState(false)

    const handleClick = () => {
        const thisBird = birds.find(b => b.speciesCode === bird.speciesCode)
        thisBird.isChecked = !thisBird.isChecked
        setIsToggled(!isToggled)
        setBirds(birds)
    }

    return (
        <div className='card'>
            <img className='bird-img' src={bird.birdImg || process.env.PUBLIC_URL + 'images/noBirdImg.png'} alt={`a ${bird.comName}`}/>
            <div className='bird-details'>
                <p>{bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
            </div>
            <input type="checkbox" checked={bird.isChecked ? 'checked' : ''} id={bird.speciesCode} name={bird.comName} value={bird.isChecked} onChange={handleClick} />
        </div>
    )
}

export default Card

Card.propTypes = {
    bird: PropTypes.object.isRequired
}
