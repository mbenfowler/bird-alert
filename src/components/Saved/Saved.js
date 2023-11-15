import { useState, useEffect, useContext } from 'react'
import { getSavedBirds } from '../../apiCalls'
import BirdsList from '../BirdsList/BirdsList'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Saved.css'

const Saved = () => {
    const [savedBirds, setSavedBirds] = useState([])
    const { user } = useContext(BirdsContext)

    useEffect(() => {
        (async() => {
            const savedBirds = await getSavedBirds(user.id)
            setSavedBirds(savedBirds)
        })()
    //eslint-disable-next-line
    }, [])

    return (
        <section id='birdsInArea'>
                <h2>Birds on your watch list:</h2>
                {savedBirds.length ? <BirdsList birds={savedBirds} /> : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
