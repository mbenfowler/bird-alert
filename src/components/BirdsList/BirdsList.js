import React from "react"
import Card from "../Card/Card"
import './BirdsList.css'

const BirdsList = ({ birdsByLocation }) => {
    const birdCards = birdsByLocation.map(bird => {
        return <Card key={bird.speciesCode} bird={bird} />
    })
    
    return (
        <div className='birds-list'>
            {birdCards}
        </div>
    )
}

export default BirdsList