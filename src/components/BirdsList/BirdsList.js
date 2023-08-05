import React from "react"
import PropTypes from "prop-types"
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

BirdsList.propTypes = {
    birds: PropTypes.arrayOf(PropTypes.shape({
        bandingCodes: PropTypes.arrayOf(PropTypes.string),
        category: PropTypes.string,
        comName: PropTypes.string.isRequired,
        comNameCodes: PropTypes.arrayOf(PropTypes.string),
        familyCode: PropTypes.string,
        familyComName: PropTypes.string,
        familySciName: PropTypes.string,
        isChecked: PropTypes.bool.isRequired,
        order: PropTypes.string,
        sciName: PropTypes.string.isRequired,
        sciNameCodes: PropTypes.arrayOf(PropTypes.string),
        speciesCode: PropTypes.string.isRequired,
        taxonOrder: PropTypes.number
    }))
}
