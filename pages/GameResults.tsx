import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchData, RankingConfig } from '../types';
import { getLoLGroups, getValorantGroups, getValorantPreQualWinner } from '../utils/groups';
import { calculateLoLStandings, calculateValorantStandings } from '../utils/tiebreakers';
import { exportToPDF, exportToCSV, exportToJSON } from '../utils/export';

export default function GameResults() {
  const { gameId } = useParams<{gameId: string}>();
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [standingsA, setStandingsA] = useState<any[]>([]);
  const [standingsB, setStandingsB] = useState<any[]>([]);
  const [preQualWinner, setPreQualWinner] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    const qMatches = query(collection(db, 'matches'), where('game', '==', gameId));
    let currentMatches: MatchData[] = [];
    let currentRanking: RankingConfig | null = null;

    const computeStandings = (m: MatchData[], r: RankingConfig | null) => {
      if (!r) return;
      if (gameId === 'lol') {
        const groups = getLoLGroups(r.lol);
        if (groups.ready) {
           setStandingsA(calculateLoLStandings(m, 'Fase de Grupos', 'A', groups.groupA));
           setStandingsB(calculateLoLStandings(m, 'Fase de Grupos', 'B', groups.groupB));
        }
      } else {
        const winner = getValorantPreQualWinner(m);
        setPreQualWinner(winner);
        const groups = getValorantGroups(r.valorant, winner);
        if (groups.ready) {
           setStandingsA(calculateValorantStandings(m, 'Fase de Grupos', 'A', groups.groupA));
           setStandingsB(calculateValorantStandings(m, 'Fase de Grupos', 'B', groups.groupB));
        }
      }
    };

    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MatchData));
      data.sort((a,b) => a.matchNumber - b.matchNumber);
      currentMatches = data;
      setMatches(data);
      computeStandings(currentMatches, currentRanking);
    });

    const unsubConfig = onSnapshot(doc(db, 'config', 'ranking'), (docSnap) => {
      if (docSnap.exists()) {
        const r = docSnap.data() as RankingConfig;
        currentRanking = r;
        computeStandings(currentMatches, currentRanking);
      }
    });
    
    return () => { unsubMatches(); unsubConfig(); };
  }, [gameId]);

  const renderLoLTable = (standings: any[], groupName: string) => (
    <div className="card">
      <h3>Grupo {groupName}</h3>
      {standings.length === 0 ? <p className="text-muted">Grupos no listos.</p> : (
        <table>
          <thead><tr><th>Pos</th><th>Facultad</th><th>PJ</th><th>V</th><th>D</th><th>Dif. Oro</th><th>Tiempo</th></tr></thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.team}>
                <td>{i + 1} {s.pendingResolution && <span title="Sorteo requerido" className="badge-pending">!</span>}</td>
                <td><Link to={`/facultades/${s.team.toLowerCase()}`} state={{ tab: 'lol' }}>{s.team}</Link></td>
                <td>{s.played}</td><td>{s.wins}</td><td>{s.losses}</td>
                <td style={{color: s.totalGoldDiff > 0 ? 'var(--success)' : (s.totalGoldDiff < 0 ? 'var(--danger)' : 'inherit')}}>
                  {s.totalGoldDiff > 0 ? '+' : ''}{Math.round(s.totalGoldDiff)}
                </td>
                <td>{Math.round(s.totalWinTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderValorantTable = (standings: any[], groupName: string) => (
    <div className="card">
      <h3>Grupo {groupName}</h3>
      {standings.length === 0 ? (
         <p style={{color: 'var(--text-muted)'}}>Esperando ganador de preclasificación.</p>
      ) : (
        <table>
          <thead><tr><th>Pos</th><th>Facultad</th><th>PJ</th><th>V</th><th>D</th><th>Dif. Rondas</th><th>Rondas Ganadas</th><th>Prom. Tiempo</th></tr></thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.team}>
                <td>
                  {i + 1} 
                  {s.pendingResolution && !s.isTiedExtraMatch && <span title="Desempate Múltiple" className="badge-pending">!</span>}
                  {s.isTiedExtraMatch && <span title="Requiere Partido Extra BO1 o Sorteo Público" className="badge-pending">Extra</span>}
                </td>
                <td><Link to={`/facultades/${s.team.toLowerCase()}`} state={{ tab: 'valorant' }}>{s.team}</Link></td>
                <td>{s.played}</td><td>{s.wins}</td><td>{s.losses}</td>
                <td style={{color: s.roundDiff > 0 ? 'var(--success)' : (s.roundDiff < 0 ? 'var(--danger)' : 'inherit')}}>
                  {s.roundDiff > 0 ? '+' : ''}{s.roundDiff}
                </td>
                <td>{s.roundsWon}</td>
                <td>{Math.round(s.avgWinTime || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const preQualMatches = matches.filter(m => m.phase.startsWith('Preclasificación'));
  const seed4Matches = matches.filter(m => m.phase === 'Playoffs - Clasificación Seed 4');

  return (
    <div>
      <div className="flex-between" style={{marginBottom: 20}}>
        <h1 style={{textTransform: 'uppercase', margin: 0}}>{gameId} - Resultados</h1>
        <div style={{display: 'flex', gap: 10}}>
          <button className="btn" onClick={()=>exportToPDF(matches, standingsA, standingsB, gameId!)}>PDF</button>
          <button className="btn" onClick={()=>exportToCSV(matches, gameId!)}>CSV</button>
          <button className="btn" onClick={()=>exportToJSON(matches, gameId!)}>JSON</button>
        </div>
      </div>

      {gameId === 'valorant' && (
        <div className="card" style={{borderColor: 'var(--val-color)'}}>
          <h3 style={{color: 'var(--val-color)'}}>Preclasificación</h3>
          {preQualMatches.length === 0 ? <p>No hay partidos registrados aún.</p> : (
            <table>
              <thead><tr><th>Fase</th><th>Enfrentamiento</th><th>Resultado</th><th>Ganador</th></tr></thead>
              <tbody>
                {preQualMatches.map(m => (
                  <tr key={m.id}>
                    <td>{m.phase}</td><td>{m.teamA} vs {m.teamB}</td>
                    <td>{m.statA} - {m.statB} {m.isWalkover && <span className="badge badge-loss">WO</span>}</td>
                    <td><span className="badge badge-win">{m.winner}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preQualWinner && (
            <div style={{marginTop: 15, padding: 10, background: 'rgba(16,185,129,0.1)', borderRadius: 5, borderLeft: '4px solid var(--success)'}}>
              <strong>Clasificado a Playoffs (Seed 1):</strong> {preQualWinner}
            </div>
          )}
        </div>
      )}
      
      <div className="grid-2">
        {gameId === 'lol' ? renderLoLTable(standingsA, 'A') : renderValorantTable(standingsA, 'A')}
        {gameId === 'lol' ? renderLoLTable(standingsB, 'B') : renderValorantTable(standingsB, 'B')}
      </div>
      
      {seed4Matches.length > 0 && (
         <div className="card" style={{marginTop: '20px', borderColor: 'var(--warning)'}}>
            <h3 style={{color: 'var(--warning)'}}>Clasificación Seed 4 (Desempate 2dos)</h3>
            <table>
               <thead><tr><th>Enfrentamiento</th><th>Resultado</th><th>Ganador</th></tr></thead>
               <tbody>
                  {seed4Matches.map(m => (
                     <tr key={m.id}>
                        <td>{m.teamA} vs {m.teamB}</td>
                        <td>{m.statA} - {m.statB} {m.isWalkover && <span className="badge badge-loss">WO</span>}</td>
                        <td><span className="badge badge-win">{m.winner}</span></td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      )}

      <div className="card" style={{marginTop: '20px'}}>
        <h3>Partidos Registrados</h3>
        <table>
          <thead><tr><th>Nº</th><th>Fase</th><th>Grupo</th><th>Enfrentamiento</th><th>Resultado</th><th>Formato</th></tr></thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id}>
                <td>{m.matchNumber}</td><td>{m.phase}</td><td>{m.group}</td>
                <td>
                  <Link to={`/facultades/${m.teamA.toLowerCase()}`} state={{ tab: gameId }}>{m.teamA}</Link> vs <Link to={`/facultades/${m.teamB.toLowerCase()}`} state={{ tab: gameId }}>{m.teamB}</Link>
                </td>
                <td>
                  {m.format === 'BO1' ? (gameId === 'lol' ? (m.isWalkover ? 'WO' : `${m.statA} - ${m.statB} oro`) : `${m.statA} - ${m.statB} rnds`) : `Serie: ${m.scoreA} - ${m.scoreB}`}
                  <br/><span className="badge badge-win">{m.winner}</span>{m.isWalkover && <span className="badge badge-loss" style={{marginLeft: 5}}>WO</span>}
                </td>
                <td>{m.format}{m.format === 'BO1' && !m.isWalkover && <><br/><span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{m.duration}m</span></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
