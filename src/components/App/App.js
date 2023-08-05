import { useState, useEffect } from  'react';
import { Routes, Route } from 'react-router-dom';
import { getBirdKeysByLocation, getBirdsData } from "../../apiCalls"
import { mockBirdKeys } from "../../mockData/birdKeys"
import './App.css';
import Nav from '../Nav/Nav';
import Error from '../Error/Error';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';
import EmptyState from '../EmptyState/EmptyState';
import BirdsContext from '../BirdsContext/BirdsContext';

const App = () => {
  const [user, setUser] = useState({
        name: "",
        location: "",
        emailAddress: "",
        phoneNumber: ""
  })
  const [birds, setBirds] = useState([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  useEffect(() => {
    if (user.location.length) {
      (async() => {
          try {
              const birdKeys = await getBirdKeysByLocation(user.location)
              // const birdsData = await getBirdsData(birdKeys)
              const birdsData = await getBirdsData(mockBirdKeys)
              setBirds(birdsData)
              setIsLoaded(true)
          } catch (error) {
              handleNetworkErrors(error)
          }
      })()
    }
  }, [user.location])

  const handleNetworkErrors = (error) => {
      setNetworkError(error.message)
  }

  return (
    <>
      <BirdsContext.Provider value={{user, setUser, birds, setBirds}}>
        <Nav setNetworkError={setNetworkError}/>
        <main className="App">
            <Routes>
              <Route path='/' element={user.location ? <Home isLoaded={isLoaded}/> : <section id='init'><p id='initText'>Go to settings and set a location</p></section>}/>
              <Route path='/saved' element={<Saved />}/>
              <Route path='/settings' element={networkError ? <Error networkError={networkError} /> : <Settings />}/>
              <Route path="*" element={<EmptyState />} />
            </Routes>
        </main>
      </BirdsContext.Provider>
    </>
  );
}

export default App;
