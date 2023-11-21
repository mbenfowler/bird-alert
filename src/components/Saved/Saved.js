import { useContext, useEffect } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import BirdsContext from '../BirdsContext/BirdsContext'
import { getSavedBirds } from '../../apiCalls'
import './Saved.css'

const Saved = () => {
    const { user, savedBirds, setSavedBirds, handleNetworkErrors } = useContext(BirdsContext)

    useEffect(() => {
        (async() => {
            try {
                setSavedBirds(await getSavedBirds(user.id))
            } catch (error) {
                handleNetworkErrors(error)
            }
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
