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
import NotFound from '../NotFound/NotFound';
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
              // eslint-disable-next-line no-unused-vars
              // const birdKeys = await getBirdKeysByLocation(user.location)
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
              <Route path='/' element={networkError ? <Error networkError={networkError} /> : user.location ? <Home isLoaded={isLoaded}/> : <section id='init'><p id='initText'>Go to settings and set a location</p></section>}/>
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
