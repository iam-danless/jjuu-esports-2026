import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchData, LOL_FACULTIES, VAL_FACULTIES, RankingConfig } from '../types';
import { calculateLoLStandings, calculateValorantStandings } from '../utils/tiebreakers';
import { getLoLGroups, getValorantGroups, getValorantPreQualWinner } from '../utils/groups';

export default function Faculty() {
  const { facultyId } = useParams();
  const location = useLocation();
  const facName = facultyId?.toUpperCase() || '';
  
  const participatesInLoL = LOL_FACULTIES.includes(facName);
  const participatesInVal = VAL_FACULTIES.includes(facName);
  
  const targetTab = location.state?.tab === 'valorant' && participatesInVal ? 'valorant' : (participatesInLoL ? 'lol' : 'valorant');
  const [activeTab, setActiveTab] = useState<'lol' | 'valorant'>(targetTab);
  const [lolMatches, setLolMatches] = useState<MatchData[]>([]);
  const [valMatches, setValMatches] = useState<MatchData[]>([]);
  const [ranking, setRanking] = useState<RankingConfig | null>(null);

  useEffect(() => {
    if (location.state?.tab) {
      if (location.state.tab === 'valorant' && participatesInVal) setActiveTab('valorant');
      else if (location.state.tab === 'lol' && participatesInLoL) setActiveTab('lol');
    } else if (facName) {
      setActiveTab(participatesInLoL ? 'lol' : 'valorant');
    }
  }, [facName, location.state, participatesInLoL, participatesInVal]);

  useEffect(() => {
    if (!facName) return;
    getDoc(doc(db, 'config', 'ranking')).then(d => { if(d.exists()) setRanking(d.data() as RankingConfig); });
    
    let unsubLoL = () => {};
    if (participatesInLoL) {
      unsubLoL = onSnapshot(query(collection(db, 'matches'), where('game', '==', 'lol')), (snap) => {
        setLolMatches(snap.docs.map(d => ({id: d.id, ...d.data()} as MatchData)));
      });
    }
    
    let unsubVal = () => {};
    if (participatesInVal) {
      unsubVal = onSnapshot(query(collection(db, 'matches'), where('game', '==', 'valorant')), (snap) => {
        setValMatches(snap.docs.map(d => ({id: d.id, ...d.data()} as MatchData)));
      });
    }
    return () => { unsubLoL(); unsubVal(); };
  }, [facName, participatesInLoL, participatesInVal]);

  const getFacultyStats = (game: 'lol' | 'valorant', matches: MatchData[]) => {
    const facMatches = matches.filter(m => m.teamA === facName || m.teamB === facName);
    facMatches.sort((a,b) => a.matchNumber - b.matchNumber);
    let groupName = '-'; let position = '-';
    let stats: any = { played: 0, wins: 0, losses: 0, totalGoldDiff: 0, totalWinTime: 0, roundDiff: 0, roundsWon: 0, winTime: 0, avgWinTime: 0 };
    
    if (ranking) {
      if (game === 'lol') {
         const { groupA, groupB, ready } = getLoLGroups(ranking.lol);
         if (ready) {
            if (groupA.includes(facName)) groupName = 'A';
            else if (groupB.includes(facName)) groupName = 'B';
            if (groupName !== '-') {
               const standings = calculateLoLStandings(matches, 'Fase de Grupos', groupName, groupName === 'A' ? groupA : groupB);
               const index = standings.findIndex((s: any) => s.team === facName);
               if (index !== -1) { position = (index + 1).toString(); stats = standings[index]; }
            }
         }
      } else {
         const preQualWinner = getValorantPreQualWinner(matches);
         if (preQualWinner === facName) {
            groupName = 'Seed 1 (Pase Directo Playoffs)'; position = '1';
            stats.played = facMatches.filter(m => m.phase.includes('Preclasificación')).length;
            stats.wins = facMatches.filter(m => m.winner === facName && m.phase.includes('Preclasificación')).length;
            stats.losses = stats.played - stats.wins;
         } else {
            const { groupA, groupB, ready } = getValorantGroups(ranking.valorant, preQualWinner);
            if (ready) {
               if (groupA.includes(facName)) groupName = 'A';
               else if (groupB.includes(facName)) groupName = 'B';
               if (groupName !== '-') {
                 const standings = calculateValorantStandings(matches, 'Fase de Grupos', groupName, groupName === 'A' ? groupA : groupB);
                 const index = standings.findIndex((s: any) => s.team === facName);
                 if (index !== -1) { position = (index + 1).toString(); stats = standings[index]; }
               }
            }
         }
      }
    }
    return { group: groupName, position, stats, history: facMatches };
  };

  const lolData = participatesInLoL ? getFacultyStats('lol', lolMatches) : null;
  const valData = participatesInVal ? getFacultyStats('valorant', valMatches) : null;
  
  const renderStats = (game: 'lol' | 'valorant', data: any) => {
    if (!data) return null;
    return (
      <div style={{animation: 'fadeIn 0.3s ease-in-out'}}>
        <div className="grid-3" style={{marginBottom: 20}}>
          <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Posición / Grupo {data.group}</h3><p style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{data.position}</p></div>
          <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Partidas Registradas</h3><p style={{fontSize: '2rem', fontWeight: 'bold'}}>{data.stats.played || 0}</p></div>
          <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>V - D</h3><p style={{fontSize: '2rem', fontWeight: 'bold'}}><span style={{color: 'var(--success)'}}>{data.stats.wins || 0}</span> - <span style={{color: 'var(--danger)'}}>{data.stats.losses || 0}</span></p></div>
        </div>
        {!data.group.includes('Seed 1') && (
          <div className="grid-2" style={{marginBottom: 20}}>
            {game === 'lol' ? (
              <>
                <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Dif. Oro</h3><p style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{(data.stats.totalGoldDiff > 0 ? '+' : '') + Math.round(data.stats.totalGoldDiff || 0)}</p></div>
                <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Tiempo Victorias</h3><p style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{Math.round(data.stats.totalWinTime || 0)} min</p></div>
              </>
            ) : (
              <>
                <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Dif. Rondas</h3><p style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{(data.stats.roundDiff > 0 ? '+' : '') + (data.stats.roundDiff || 0)}</p></div>
                <div className="card text-center"><h3 style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Rondas Ganadas</h3><p style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{data.stats.roundsWon || 0}</p></div>
              </>
            )}
          </div>
        )}
        <div className="card">
          <h3>Historial</h3>
          <table>
            <thead><tr><th>Nº</th><th>Fase</th><th>Rival</th><th>Resultado</th><th>Estado</th></tr></thead>
            <tbody>
              {data.history.length === 0 && <tr><td colSpan={5} className="text-center">Sin partidos</td></tr>}
              {data.history.map((m: any) => {
                const isTeamA = m.teamA === facName;
                const rival = isTeamA ? m.teamB : m.teamA;
                const isWin = m.winner === facName;
                const scoreStr = m.format === 'BO1' ? (isTeamA ? `${m.statA||0} - ${m.statB||0}` : `${m.statB||0} - ${m.statA||0}`) : (isTeamA ? `Serie ${m.scoreA||0} - ${m.scoreB||0}` : `Serie ${m.scoreB||0} - ${m.scoreA||0}`);
                return (
                  <tr key={m.id}>
                    <td>{m.matchNumber}</td><td>{m.phase}</td><td><Link to={`/facultades/${rival.toLowerCase()}`} state={{ tab: game }}>{rival}</Link></td>
                    <td>{m.isWalkover && game==='lol' ? 'WO' : scoreStr} {m.isWalkover && game==='valorant' && <span className="badge badge-loss">WO</span>}</td>
                    <td><span className={`badge ${isWin ? 'badge-win' : 'badge-loss'}`}>{isWin ? 'VICTORIA' : 'DERROTA'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 style={{marginBottom: '20px'}}>Facultad: {facName}</h1>
      <div className="tabs">
        {participatesInLoL && <button className={`tab-btn ${activeTab === 'lol' ? 'active' : ''}`} onClick={() => setActiveTab('lol')}>League of Legends</button>}
        {participatesInVal && <button className={`tab-btn ${activeTab === 'valorant' ? 'active' : ''}`} onClick={() => setActiveTab('valorant')}>Valorant</button>}
      </div>
      {activeTab === 'lol' && lolData && renderStats('lol', lolData)}
      {activeTab === 'valorant' && valData && renderStats('valorant', valData)}
    </div>
  );
}
