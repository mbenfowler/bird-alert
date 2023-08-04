import { useContext } from "react"
import BirdsList from "../BirdsList/BirdsList"
import BirdsContext from "../BirdsContext/BirdsContext"
import './Home.css'

const Home = ({ isLoaded }) => {
    const { birds } = useContext(BirdsContext)
    
    return (
        <>
            <section id='alerts'>
                <div>No alerts yet!</div>
            </section>
            <section id='birdsInArea'>
                <h2>Birds in your area:</h2>
                {isLoaded ? <BirdsList birds={birds} /> : <p>Loading...</p>}
            </section>
        </>
    )
}

export default Home
