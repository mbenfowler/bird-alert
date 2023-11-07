import { useState, useEffect } from 'react'
import { getSavedBirds } from '../../apiCalls'
import BirdsList from '../BirdsList/BirdsList'
import './Saved.css'

const Saved = () => {
    const [savedBirds, setSavedBirds] = useState([])

    useEffect(() => {
        (async() => {
            const savedBirds = await getSavedBirds()
            setSavedBirds(savedBirds)
        })()
    }, [])

    return (
        <section id='birdsInArea'>
                <h2>Birds on your watch list:</h2>
                {savedBirds.length ? <BirdsList birds={savedBirds} /> : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
