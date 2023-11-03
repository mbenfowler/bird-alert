import { useState, useEffect } from  'react';
import { Routes, Route } from 'react-router-dom';
import { getBirdKeysByLocation, getBirdsData, getUser } from "../../apiCalls"
import { mockBirdKeys } from "../../mockData/birdKeys"
import './App.css';
import Nav from '../Nav/Nav';
import Error from '../Error/Error';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';
import NotFound from '../NotFound/NotFound';
import BirdsContext from '../BirdsContext/BirdsContext';

const App = () => {
  const [user, setUser] = useState()
  const [birds, setBirds] = useState([])
  // need to pull in savedBirds here so we can compare and apply isChecked to birds
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState()
  const [isLoaded, setIsLoaded] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  const RESULTS_PER_PAGE = 2

  useEffect(() => {
    (async() => {
      try {
          const user = await getUser()
          setUser(user)
          setIsLoaded(true)
      } catch (error) {
          handleNetworkErrors(error)
      }
    })()
  }, [isLoaded])

  useEffect(() => {
    if (user && user.location) {
      (async() => {
          try {
              // eslint-disable-next-line no-unused-vars
              // const birdKeys = await getBirdKeysByLocation(user.location)
              // const birdsData = await getBirdsData(birdKeys)
              const mutatableBirdKeys = [...mockBirdKeys]
              const splicedBirdKeys = spliceBirdKeys(mutatableBirdKeys, RESULTS_PER_PAGE)
              const splicedBirdsData = await getBirdsData(splicedBirdKeys[currentPage - 1])
              setBirds(splicedBirdsData)
              setIsLoaded(true)
          } catch (error) {
              handleNetworkErrors(error)
          }
      })()
    }
  }, [user, user?.location, currentPage])

  const handleNetworkErrors = (error) => {
      setNetworkError(error.message)
  }

  const spliceBirdKeys = (arr, chunkSize) => {
    const splicedBirdKeys = [];
    while (arr.length > 0) {
        const chunk = arr.splice(0, chunkSize);
        splicedBirdKeys.push(chunk);
    }

    setPageCount(splicedBirdKeys.length)
    return splicedBirdKeys;
  }

  return (
    <>
      <BirdsContext.Provider value={{user, setUser, birds, setBirds, currentPage, setCurrentPage, pageCount, setIsLoaded}}>
        <Nav setNetworkError={setNetworkError}/>
        <main className="App">
            <Routes>
              <Route path='/' element={networkError ? <Error networkError={networkError} /> : user?.location ? <Home isLoaded={isLoaded}/> : <section id='init'><p id='initText'>Go to settings and set a location</p></section>}/>
              <Route path='/saved' element={<Saved />}/>
              <Route path='/settings' element={<Settings />}/>
              <Route path="*" element={<NotFound />} />
            </Routes>
        </main>
      </BirdsContext.Provider>
    </>
  );
}

export default App;
