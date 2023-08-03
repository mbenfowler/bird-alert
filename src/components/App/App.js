import { useState } from  'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Nav from '../Nav/Nav';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';
import EmptyState from '../EmptyState/EmptyState';
import WatchedBirdsContext from '../WatchedBirdsContext/WatchedBirdsContext';

const App = () => {
  const [watchedBirds, setWatchedBirds] = useState([])

  console.log(watchedBirds)
  return (
    <>
      <WatchedBirdsContext.Provider value={{watchedBirds, setWatchedBirds}}>
        <Nav />
        <main className="App">
          <Routes>
            <Route path='/' element={<Home />}/>
            <Route path='/saved' element={<Saved />}/>
            <Route path='/settings' element={<Settings />}/>
            <Route path="*" element={<EmptyState />} />
          </Routes>
        </main>
      </WatchedBirdsContext.Provider>
    </>
  );
}

export default App;
