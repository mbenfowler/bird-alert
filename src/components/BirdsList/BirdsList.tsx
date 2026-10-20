import Card from '../Card/Card'
import type { Bird } from '../../types'
import './BirdsList.css'

interface BirdsListProps {
    birds: Bird[]
}

const BirdsList = ({ birds }: BirdsListProps) => (
    <section className='birds-list'>
        {birds.map(bird => <Card key={bird.speciesCode} bird={bird} />)}
    </section>
)

export default BirdsList
