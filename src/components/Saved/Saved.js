import { useContext, useState, useEffect } from 'react'
import BirdsList from '../BirdsList/BirdsList'
import BirdsContext from '../BirdsContext/BirdsContext'
import { getSavedBirds } from '../../apiCalls'
import './Saved.css'

const Saved = () => {
    const { user, savedBirds, setSavedBirds, handleNetworkErrors } = useContext(BirdsContext)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageCount, setPageCount] = useState()
    const [chunkOfBirds, setChunkOfBirds] = useState([])

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

    const spliceBirds = (arr, chunkSize) => {
        const splicedBirds = [];
        while (arr.length > 0) {
            const chunk = arr.splice(0, chunkSize);
            splicedBirds.push(chunk);
        }

        setPageCount(splicedBirds.length)
        return splicedBirds;
    }

    const RESULTS_PER_PAGE = 5

    useEffect(() => {
        const mutatableBirds = [...savedBirds]
        const splicedBirds = spliceBirds(mutatableBirds, RESULTS_PER_PAGE)
        setChunkOfBirds(splicedBirds[currentPage - 1])
    //eslint-disable-next-line
    }, [savedBirds, currentPage])

    const handlePageChange = (e) => {
        if (e.target.innerText === '<') {
            setCurrentPage(prev => prev - 1)
        } else {
            setCurrentPage(prev => prev + 1)
        }
    }

    return (
        <section id='birdsInArea'>
                <h2>Birds on your watch list:</h2>
                {savedBirds.length
                ? <>
                    <BirdsList birds={chunkOfBirds} />
                    <div className='pagination'>
                        {currentPage !== 1 && <button className='pagination-btn' onClick={handlePageChange}>&lt;</button>}
                        <p>{`Page ${currentPage} of ${pageCount}`}</p>
                        {currentPage !== pageCount && <button className='pagination-btn' onClick={handlePageChange}>&gt;</button>}
                    </div>
                  </>
                : <p className='info-text'>You don't have any birds on your watch list yet. Go to the home page to add some!</p>}
        </section>
    )
}

export default Saved
