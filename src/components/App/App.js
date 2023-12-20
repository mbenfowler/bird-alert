import { useState, useEffect } from  'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { getBirdKeysByLocation, getBirdsData, getSavedBirds, getBirdObservationsByLocation, getAllBirds } from "../../apiCalls"
// import { mockBirdKeys } from "../../mockData/birdKeys"
import './App.css';
import Login from '../Login/Login';
import Nav from '../Nav/Nav';
import Error from '../Error/Error';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';
import EmailConfirm from '../EmailConfirm/EmailConfirm';
import PassReset from '../PassReset/PassReset';
import NotFound from '../NotFound/NotFound';
import BirdsContext from '../BirdsContext/BirdsContext';

const App = () => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })
  const [birds, setBirds] = useState([])
  const [allBirds, setAllBirds] = useState([])
  const [savedBirds, setSavedBirds] = useState([])
  const [recentObservations, setRecentObservations] = useState([])
  const [birdAlerts, setBirdAlerts] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState()
  const [isLoaded, setIsLoaded] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  const RESULTS_PER_PAGE = 5

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login')
    } else {
      const userToStore = { ...user, password: 'nunya' }
      localStorage.setItem('user', JSON.stringify(userToStore))
      setIsLoaded(true)
    }
  //eslint-disable-next-line
  }, [user])

  useEffect(() => {
    (async() => {
      try {
        if (user && user.location) {
          setAllBirds(await getAllBirds())
          setRecentObservations(await getBirdObservationsByLocation(user.location))
        }
      } catch (error) {
        handleNetworkErrors(error)
      }
    })()
  //eslint-disable-next-line
  }, [user, user?.location])

  useEffect(() => {
    if (user && user.location) {
      (async() => {
          try {
            const savedBirdsObserved = recentObservations.filter(obs => savedBirds.find(savedBird => savedBird.speciesCode === obs.speciesCode))
            setBirdAlerts(savedBirdsObserved)
          } catch (error) {
              handleNetworkErrors(error)
          }
      })()
    }
  //eslint-disable-next-line
  }, [user, user?.location, savedBirds, recentObservations])

  useEffect(() => {
    if (user && user.location) {
      (async() => {
          try {
              setSavedBirds(await getSavedBirds(user.id))
              const birdKeys = await getBirdKeysByLocation(user.location)
              const mutatableBirdKeys = [...birdKeys]
              const splicedBirdKeys = spliceBirdKeys(mutatableBirdKeys, RESULTS_PER_PAGE)
              const splicedBirdsData = await getBirdsData(splicedBirdKeys[currentPage - 1])
              const checkedBirds = splicedBirdsData.map(bird => {
                const savedBird = savedBirds.find(savedBird => savedBird && savedBird.speciesCode === bird.speciesCode)
                if (savedBird) {
                  return { ...bird, isChecked: true }
                }
                return bird
              })
              setBirds(checkedBirds)
              setIsLoaded(true)
          } catch (error) {
              handleNetworkErrors(error)
          }
      })()
    }
  //eslint-disable-next-line
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
      <BirdsContext.Provider value={{user, setUser, birds, setBirds, allBirds, savedBirds, setSavedBirds, recentObservations, birdAlerts, setBirdAlerts, currentPage, setCurrentPage, pageCount, setIsLoaded, handleNetworkErrors}}>
        <Nav setNetworkError={setNetworkError}/>
        <main className="App">
            <Routes>
              <Route path='/' element={networkError ? <Error networkError={networkError} /> : user?.location ? <Home isLoaded={isLoaded}/> : <section id='init'><p id='initText'>Go to settings and set a location</p><Link to='/settings'><button className='navigate-button'>Go to settings</button></Link></section>} />
              <Route path='/login' element={<Login />} />
              <Route path='/saved' element={<Saved />} />
              <Route path='/settings' element={<Settings isLoaded={isLoaded}/>} />
              <Route path='/reset/:email' element={<PassReset />} />
              <Route path='/confirm/:email' element={<EmailConfirm />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ToastContainer />
        </main>
      </BirdsContext.Provider>
    </>
  );
}

export default App;
