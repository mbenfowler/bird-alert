import { useContext } from 'react'
import BirdsContext from '../BirdsContext/BirdsContext'
import BirdsList from '../BirdsList/BirdsList'

const Saved = () => {
    const { birds } = useContext(BirdsContext)

    return (
        <section id='birdsInArea'>
                <h2>Birds on your watch list:</h2>
                <BirdsList birds={birds.filter(bird => bird.isChecked)} />
        </section>
    )
}

export default Saved