import { useContext, useState, useEffect } from "react"
import PropTypes from "prop-types"
import BirdAlerts from "../BirdAlerts/BirdAlerts"
import BirdsList from "../BirdsList/BirdsList"
import BirdsContext from "../BirdsContext/BirdsContext"
import './Home.css'

const Home = ({ isLoaded }) => {
    const { birdAlerts, birds, allBirds, currentPage, setCurrentPage, pageCount, setIsLoaded } = useContext(BirdsContext)
    const [search, setSearch] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [searchedBirds, setSearchedBirds] = useState([])

    useEffect(() => {
        if (search.length > 0) {
            setIsSearching(true)
        } else {
            setIsSearching(false)
        }

        if (search.length >= 3) {
            const filteredBirds = allBirds.filter(bird => bird.comName.toLowerCase().includes(search))
            setSearchedBirds(filteredBirds)
        }
    // eslint-disable-next-line
    }, [search])

    const handlePageChange = (e) => {
        setIsLoaded(false)
        if (e.target.innerText === '<') {
            setCurrentPage(prev => prev - 1)
        } else {
            setCurrentPage(prev => prev + 1)
        }
    }

    const handleSearch = (e) => {
        setSearch(e.target.value.toLowerCase())
    }

    return (
        <>
            <section id='alertArea'>
                <BirdAlerts alerts={birdAlerts} />
            </section>
            <section id='birdsInArea'>
                <input id='birdSearch' type="text" placeholder='Search birds by name' onChange={handleSearch}/>
                {isLoaded && !isSearching
                    ? <><h2 className='fredericka'>Birds in your area:</h2> <BirdsList birds={birds} /></>
                    : isLoaded && isSearching && search.length >= 3 && searchedBirds.length > 0
                    ? <><h2 className='note fredericka'>Note: these birds may not be common to your area</h2><BirdsList birds={searchedBirds} /></>
                    : isLoaded && isSearching && search.length >= 3 && searchedBirds.length === 0
                    ? <h3 className='fredericka'>No birds found</h3>
                    : <div className='spinner'></div>
                }
            </section>
            {isLoaded && !isSearching &&
                <div className='pagination'>
                    {currentPage !== 1 && <button className='pagination-btn' onClick={handlePageChange}>&lt;</button>}
                    <p>{`Page ${currentPage} of ${pageCount}`}</p>
                    {currentPage !== pageCount && <button className='pagination-btn' onClick={handlePageChange}>&gt;</button>}
                </div>
            }
        </>
    )
}

export default Home

Home.propTypes = {
    isLoaded: PropTypes.bool.isRequired
};
