import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import GameResults from './pages/GameResults';
import Faculty from './pages/Faculty';

function App() {
  return (
    <BrowserRouter>
      <div className="container">
        <nav className="navbar">
          <h2><Link to="/" style={{color: 'white', textDecoration: 'none'}}>JJUU UNA 2026</Link></h2>
          <div className="nav-links">
            <Link to="/game/lol">League of Legends</Link>
            <Link to="/game/valorant">Valorant</Link>
            <Link to="/admin" className="badge badge-admin">Admin</Link>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:gameId" element={<GameResults />} />
          <Route path="/facultades/:facultyId" element={<Faculty />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
export default App;