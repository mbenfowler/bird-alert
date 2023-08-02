import { Routes, Route } from 'react-router-dom';
import './App.css';
import Nav from '../Nav/Nav';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';
import EmptyState from '../EmptyState/EmptyState';

const App = () => {

  
  return (
    <>
      <Nav />
      <main className="App">
        <Routes>
          <Route path='/' element={<Home />}/>
          <Route path='/saved' element={<Saved />}/>
          <Route path='/settings' element={<Settings />}/>
          <Route path="*" element={<EmptyState />} />
        </Routes>
      </main>
    </>
    
  );
}

export default App;
