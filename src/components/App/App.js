import { useState, useEffect } from  'react';
import { Routes, Route } from 'react-router-dom';
import { getBirdKeysByLocation, getBirdsData } from "../../apiCalls"
import { mockBirdKeys } from "../../mockData/birdKeys"
import './App.css';
import Nav from '../Nav/Nav';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';
import EmptyState from '../EmptyState/EmptyState';
import BirdsContext from '../BirdsContext/BirdsContext';

const App = () => {
  const [birds, setBirds] = useState([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [networkError, setNetworkError] = useState(null)
  const dummyLoc = 'US-GA-139'

  useEffect(() => {
      (async() => {
          try {
              // const birdKeys = await getBirdKeysByLocation(dummyLoc)
              // const birdsData = await getBirdsData(birdKeys)
              const birdsData = getBirdsData(mockBirdKeys)
              setBirds(birdsData)
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
      <BirdsContext.Provider value={{birds, setBirds}}>
        <Nav />
        <main className="App">
          <Routes>
            <Route path='/' element={<Home isLoaded={isLoaded}/>}/>
            <Route path='/saved' element={<Saved />}/>
            <Route path='/settings' element={<Settings />}/>
            <Route path="*" element={<EmptyState />} />
          </Routes>
        </main>
      </BirdsContext.Provider>
    </>
  );
}

export default App;
