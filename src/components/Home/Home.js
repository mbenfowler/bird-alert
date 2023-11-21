import { useContext } from "react"
import PropTypes from "prop-types"
import BirdsList from "../BirdsList/BirdsList"
import BirdsContext from "../BirdsContext/BirdsContext"
import './Home.css'

const Home = ({ isLoaded }) => {
    const { birds, currentPage, setCurrentPage, pageCount, setIsLoaded } = useContext(BirdsContext)

    const handlePageChange = (e) => {
        setIsLoaded(false)
        if (e.target.innerText === '<') {
            setCurrentPage(prev => prev - 1)
        } else {
            setCurrentPage(prev => prev + 1)
        }
    }
    
    return (
        <>
            <section id='alerts'>
                <div>No alerts yet!</div>
            </section>
            <section id='birdsInArea'>
                <h2>Birds in your area:</h2>
                {isLoaded ? <BirdsList birds={birds} /> : <p>Loading...</p>}
            </section>
            <div className='pagination'>
                {currentPage !== 1 && <button className='pagination-btn' onClick={handlePageChange}>&lt;</button>}
                <p>{`Page ${currentPage} of ${pageCount}`}</p>
                {currentPage !== pageCount && <button className='pagination-btn' onClick={handlePageChange}>&gt;</button>}
            </div>
        </>
    )
}

export default Home

Home.propTypes = {
    isLoaded: PropTypes.bool.isRequired
};
