import React from "react"
import Card from "../Card/Card"
import './BirdsList.css'

const BirdsList = ({ birds }) => {
    const birdCards = birds.map(bird => {
        return <Card key={bird.speciesCode} bird={bird} />
    })
    
    return (
        <div className='birds-list'>
            {birdCards}
        </div>
    )
}

export default BirdsList