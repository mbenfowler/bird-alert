import { Routes, Route } from 'react-router-dom';
import './App.css';
import Nav from '../Nav/Nav';
import Home from '../Home/Home';
import Saved from '../Saved/Saved';
import Settings from '../Settings/Settings';

const App = () => {

  
  return (
    <>
      <Nav />
      <main className="App">
        <Routes>
          <Route path='/' element={<Home />}/>
          <Route path='/saved' element={<Saved />}/>
          <Route path='/settings' element={<Settings />}/>
        </Routes>
      </main>
    </>
    
  );
}

export default App;
