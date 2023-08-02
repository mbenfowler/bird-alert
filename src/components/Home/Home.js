import { useState, useEffect } from "react"
import { getBirdKeysByLocation, getBirdsData } from "../../apiCalls"
import { mockBirdKeys } from "../../mockData/birdKeys"

const Home = () => {
    const [birdsByLocation, setBirdsByLocation] = useState()
    const [networkError, setNetworkError] = useState(null)
    const dummyLoc = 'US-GA-139'
    
    useEffect(() => {
        (async() => {
            try {
                // const birdKeys = await getBirdKeysByLocation(dummyLoc)
                // const birdsData = await getBirdsData(birdKeys)
                const birdsData = getBirdsData(mockBirdKeys)
                setBirdsByLocation(birdsData)
            } catch (error) {
                handleNetworkErrors(error)
            }
        })()
    }, [])

    const handleNetworkErrors = (error) => {
        setNetworkError(error.message)
    }
    
    return (
        <section id='birdsInArea'>

        </section>
    )
}

export default Home
