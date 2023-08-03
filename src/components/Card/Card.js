import { useState, useContext } from "react"
import './Card.css'
import WatchedBirdContext from "../WatchedBirdsContext/WatchedBirdsContext"

const Card = ({ bird }) => {
    const [isChecked, setIsChecked] = useState(false)
    const { setWatchedBirds } = useContext(WatchedBirdContext)

    const handleClick = (e) => {
        console.log(e.target)
        setIsChecked(!isChecked)
        setWatchedBirds((prev) => {
            if (!isChecked) {
                return [...prev, e.target]
            } else {
                return prev.filter(bird => bird.id !== e.target.id)
            }
        })
    }

    return (
        <div className='card'>
            <img className='bird-img' src={process.env.PUBLIC_URL + 'images/testBirdImg.png'} alt={`a ${bird.comName}`}/>
            <div className='bird-details'>
                <p>Bird name: {bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
            </div>
            <input type="checkbox" id={bird.comName} name={bird.comName} value={isChecked} onClick={(e) => handleClick(e)} />
        </div>
    )
}

export default Card