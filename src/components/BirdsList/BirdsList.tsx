import Card from '../Card/Card'
import type { Bird } from '../../types'
import './BirdsList.css'

interface BirdsListProps {
    birds: Bird[]
}

const BirdsList = ({ birds }: BirdsListProps) => (
    <section className='birds-list'>
        {birds.map(bird => (
            <a key={bird.speciesCode} href={bird.wikiURL || undefined} target="_blank" rel="noreferrer">
                <Card bird={bird} />
            </a>
        ))}
    </section>
)

export default BirdsList
