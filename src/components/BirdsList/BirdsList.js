import React from "react"
import PropTypes from "prop-types"
import Card from "../Card/Card"
import './BirdsList.css'
import { Link } from "react-router-dom"

const BirdsList = ({ birds }) => {
    const birdCards = birds.map(bird => {
        return (
            <Link key={bird.speciesCode} to={bird.wikiURL} target="_blank">
                <Card key={bird.speciesCode} bird={bird}/>
            </Link>
        )
    })
    
    return (
        <section className='birds-list'>
            {birdCards}
        </section>
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
        order: PropTypes.string,
        sciName: PropTypes.string.isRequired,
        sciNameCodes: PropTypes.arrayOf(PropTypes.string),
        speciesCode: PropTypes.string.isRequired,
        taxonOrder: PropTypes.number
    }))
}
