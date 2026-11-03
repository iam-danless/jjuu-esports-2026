import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="text-center" style={{padding: '50px 0'}}>
      <h1 style={{fontSize: '3rem', marginBottom: '20px'}}>Juegos Universitarios UNA 2026</h1>
      <p style={{color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.2rem'}}>Plataforma Oficial de Resultados Esports</p>
      
      <div className="grid-2">
        <div className="card" style={{borderColor: 'var(--lol-color)'}}>
          <h2 style={{color: 'var(--lol-color)', marginBottom: '15px'}}>League of Legends</h2>
          <p style={{marginBottom: '20px', color: 'var(--text-muted)'}}>Fase de Grupos BO1, Playoffs BO3</p>
          <Link to="/game/lol" className="btn" style={{backgroundColor: 'var(--lol-color)'}}>Ver Resultados</Link>
        </div>
        <div className="card" style={{borderColor: 'var(--val-color)'}}>
          <h2 style={{color: 'var(--val-color)', marginBottom: '15px'}}>Valorant</h2>
          <p style={{marginBottom: '20px', color: 'var(--text-muted)'}}>Preclasificación, Fase de Grupos, Playoffs</p>
          <Link to="/game/valorant" className="btn" style={{backgroundColor: 'var(--val-color)'}}>Ver Resultados</Link>
        </div>
      </div>
    </div>
  );
}