import React from "react"
import './Card.css'

const Card = ({ bird }) => {
    return (
        <div className='card'>
            <img className='bird-img' src={process.env.PUBLIC_URL + 'images/testBirdImg.png'} alt={`a ${bird.comName}`}/>
            <div className='bird-details'>
                <p>Bird name: {bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
            </div>
        </div>
    )
}

export default Card