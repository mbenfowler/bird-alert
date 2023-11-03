import { useState, useEffect } from 'react'
import { getSavedBirds } from '../../apiCalls'
import BirdsList from '../BirdsList/BirdsList'

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
                <BirdsList birds={savedBirds} saved={true}/>
        </section>
    )
}

export default Saved
