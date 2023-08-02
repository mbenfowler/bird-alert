import { useState, useEffect } from "react"
import { getBirdKeysByLocation, getBirdsData } from "../../apiCalls"
import { mockBirdKeys } from "../../mockData/birdKeys"
import BirdsList from "../BirdsList/BirdsList"
import './Home.css'

const Home = () => {
    const [birdsByLocation, setBirdsByLocation] = useState()
    const [isLoaded, setIsLoaded] = useState(false)
    const [networkError, setNetworkError] = useState(null)
    const dummyLoc = 'US-GA-139'
    
    useEffect(() => {
        (async() => {
            try {
                // const birdKeys = await getBirdKeysByLocation(dummyLoc)
                // const birdsData = await getBirdsData(birdKeys)
                const birdsData = getBirdsData(mockBirdKeys)
                setBirdsByLocation(birdsData)
                setTimeout(() => {
                    setIsLoaded(true)
                }, 1000)
            } catch (error) {
                handleNetworkErrors(error)
            }
        })()
    }, [])

    const handleNetworkErrors = (error) => {
        setNetworkError(error.message)
    }
    
    return (
        <>
            <section id='alerts'>
                <div>No alerts yet!</div>
            </section>
            <section id='birdsInArea'>
                <h2>Birds in your area:</h2>
                {isLoaded ? <BirdsList birdsByLocation={birdsByLocation} /> : <p>Loading...</p>}
            </section>
        </>
    )
}

export default Home
