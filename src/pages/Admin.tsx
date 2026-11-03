import { useState, useEffect, useMemo } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, serverTimestamp, query, orderBy, onSnapshot, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MatchData, RankingConfig, LOL_FACULTIES, VAL_FACULTIES } from '../types';
import { getLoLGroups, getValorantGroups, getValorantPreQualWinner } from '../utils/groups';
import { calculateLoLStandings, calculateValorantStandings } from '../utils/tiebreakers';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  
  const [activeTab, setActiveTab] = useState<'matches' | 'config'>('matches');
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [rankingConfig, setRankingConfig] = useState<RankingConfig | null>(null);
  const [hasConfigData, setHasConfigData] = useState(false);
  
  const [rankLoL, setRankLoL] = useState<string[]>(Array(10).fill(''));
  const [rankVal, setRankVal] = useState<string[]>(Array(9).fill(''));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [game, setGame] = useState<'lol'|'valorant'>('lol');
  const [matchNumber, setMatchNumber] = useState('');
  const [phase, setPhase] = useState('Fase de Grupos');
  const [group, setGroup] = useState('A');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [statA, setStatA] = useState('');
  const [statB, setStatB] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [duration, setDuration] = useState('');
  const [isWalkover, setIsWalkover] = useState(false);
  const [winner, setWinner] = useState('');

  const isPlayoffs = phase.includes('Playoffs');
  const isPreQual = phase.includes('Preclasificación');
  const format = (isPlayoffs && phase !== 'Playoffs - 3er Puesto' && phase !== 'Playoffs - Clasificación Seed 4') ? 'BO3' : 'BO1';

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const adminDoc = await getDoc(doc(db, 'admins', u.uid));
        setIsAdminAuth(adminDoc.exists());
      } else setIsAdminAuth(false);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAdminAuth) return;
    const unsubMatches = onSnapshot(query(collection(db, 'matches'), orderBy('matchNumber', 'asc')), (snap) => {
      setMatches(snap.docs.map(d => ({id: d.id, ...d.data()} as MatchData)));
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'ranking'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RankingConfig;
        setRankingConfig(data);
        setRankLoL(data.lol);
        setRankVal(data.valorant);
        setHasConfigData(true);
      } else {
        setHasConfigData(false);
        setRankLoL(Array(10).fill(''));
        setRankVal(Array(9).fill(''));
      }
    });
    return () => { unsubMatches(); unsubConfig(); };
  }, [isAdminAuth]);

  // Derived Standings for Playoffs Auto-population
  const lolGroups = useMemo(() => rankingConfig ? getLoLGroups(rankingConfig.lol) : null, [rankingConfig]);
  const valPreQualWinner = useMemo(() => getValorantPreQualWinner(matches), [matches]);
  const valGroups = useMemo(() => rankingConfig ? getValorantGroups(rankingConfig.valorant, valPreQualWinner) : null, [rankingConfig, valPreQualWinner]);
  
  const standings = useMemo(() => {
    if (!rankingConfig) return null;
    const s: any = { lol: { A: [], B: [] }, val: { A: [], B: [] } };
    if (lolGroups?.ready) {
      s.lol.A = calculateLoLStandings(matches.filter(m=>m.game==='lol'), 'Fase de Grupos', 'A', lolGroups.groupA);
      s.lol.B = calculateLoLStandings(matches.filter(m=>m.game==='lol'), 'Fase de Grupos', 'B', lolGroups.groupB);
    }
    if (valGroups?.ready) {
      s.val.A = calculateValorantStandings(matches.filter(m=>m.game==='valorant'), 'Fase de Grupos', 'A', valGroups.groupA);
      s.val.B = calculateValorantStandings(matches.filter(m=>m.game==='valorant'), 'Fase de Grupos', 'B', valGroups.groupB);
    }
    return s;
  }, [matches, rankingConfig, lolGroups, valGroups]);

  let availableFaculties = game === 'lol' ? LOL_FACULTIES : VAL_FACULTIES;
  const configCompleteLoL = rankLoL.every(f => f !== '') && new Set(rankLoL).size === 10;
  const configCompleteVal = rankVal.every(f => f !== '') && new Set(rankVal).size === 9;

  if (phase === 'Fase de Grupos' && hasConfigData) {
    if (game === 'lol') availableFaculties = group === 'A' ? (lolGroups?.groupA || []) : (lolGroups?.groupB || []);
    else availableFaculties = group === 'A' ? (valGroups?.groupA || []) : (valGroups?.groupB || []);
  }

  // Pre-load logic for PreQual and Playoffs
  useEffect(() => {
    if (editingId) return; // Prevent overwriting during edit load

    if (isPreQual && game === 'valorant' && hasConfigData) {
      setGroup('-');
      if (phase === 'Preclasificación - Semifinal 1') { setTeamA(rankVal[0]); setTeamB(rankVal[3]); }
      else if (phase === 'Preclasificación - Semifinal 2') { setTeamA(rankVal[1]); setTeamB(rankVal[2]); }
      else if (phase === 'Preclasificación - Final') {
        const semi1 = matches.find(m => m.game === 'valorant' && m.phase === 'Preclasificación - Semifinal 1');
        const semi2 = matches.find(m => m.game === 'valorant' && m.phase === 'Preclasificación - Semifinal 2');
        if (semi1?.winner && semi2?.winner) { setTeamA(semi1.winner); setTeamB(semi2.winner); }
        else { setTeamA(''); setTeamB(''); }
      }
    } else if (isPlayoffs && standings) {
      setGroup('Playoffs');
      let autoA = ''; let autoB = '';
      if (game === 'lol') {
         if (phase === 'Playoffs - Semifinal 1') { autoA = standings.lol.B[0]?.team || ''; autoB = standings.lol.A[1]?.team || ''; }
         if (phase === 'Playoffs - Semifinal 2') { autoA = standings.lol.A[0]?.team || ''; autoB = standings.lol.B[1]?.team || ''; }
         if (phase === 'Playoffs - 3er Puesto' || phase === 'Playoffs - Final') {
            const s1 = matches.find(m => m.game==='lol' && m.phase==='Playoffs - Semifinal 1');
            const s2 = matches.find(m => m.game==='lol' && m.phase==='Playoffs - Semifinal 2');
            if (s1 && s2) {
               if (phase === 'Playoffs - Final') { autoA = s1.winner; autoB = s2.winner; }
               else { autoA = s1.teamA === s1.winner ? s1.teamB : s1.teamA; autoB = s2.teamA === s2.winner ? s2.teamB : s2.teamA; }
            }
         }
      } else if (game === 'valorant') {
         const seed4Qual = matches.find(m => m.game==='valorant' && m.phase==='Playoffs - Clasificación Seed 4');
         if (phase === 'Playoffs - Clasificación Seed 4') { autoA = standings.val.A[1]?.team || ''; autoB = standings.val.B[1]?.team || ''; }
         if (phase === 'Playoffs - Semifinal 1') { autoA = standings.val.A[0]?.team || ''; autoB = standings.val.B[0]?.team || ''; }
         if (phase === 'Playoffs - Semifinal 2') { autoA = valPreQualWinner || ''; autoB = seed4Qual?.winner || ''; }
         if (phase === 'Playoffs - 3er Puesto' || phase === 'Playoffs - Final') {
            const s1 = matches.find(m => m.game==='valorant' && m.phase==='Playoffs - Semifinal 1');
            const s2 = matches.find(m => m.game==='valorant' && m.phase==='Playoffs - Semifinal 2');
            if (s1 && s2) {
               if (phase === 'Playoffs - Final') { autoA = s1.winner; autoB = s2.winner; }
               else { autoA = s1.teamA === s1.winner ? s1.teamB : s1.teamA; autoB = s2.teamA === s2.winner ? s2.teamB : s2.teamA; }
            }
         }
      }
      setTeamA(autoA); setTeamB(autoB);
    } else if (phase === 'Fase de Grupos') {
      if (teamA && !availableFaculties.includes(teamA)) setTeamA('');
      if (teamB && !availableFaculties.includes(teamB)) setTeamB('');
    }
  }, [game, phase, hasConfigData, matches, isPreQual, isPlayoffs, rankVal, standings, availableFaculties, editingId, valPreQualWinner]);

  useEffect(() => {
    if (format === 'BO1' && !isWalkover && statA && statB) {
      if (game === 'valorant') {
         if (Number(statA) > Number(statB)) setWinner(teamA);
         else if (Number(statB) > Number(statA)) setWinner(teamB);
         else setWinner('');
      }
    } else if (format === 'BO3' && scoreA && scoreB) {
      if (Number(scoreA) > Number(scoreB)) setWinner(teamA);
      else if (Number(scoreB) > Number(scoreA)) setWinner(teamB);
    }
  }, [statA, statB, scoreA, scoreB, format, game, isWalkover, teamA, teamB]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, pass); } catch { alert('Credenciales inválidas.'); }
  };

  const logAudit = (batch: any, action: string, docId: string, oldData: any, newData: any) => {
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(logRef, { user: user.uid, timestamp: serverTimestamp(), action, collection: 'matches', docId, oldData, newData });
  };

  const handleSaveConfig = async () => {
    if (new Set(rankLoL).size !== 10) return alert("Error: Hay facultades duplicadas o faltantes en LoL.");
    if (new Set(rankVal).size !== 9) return alert("Error: Hay facultades duplicadas o faltantes en Valorant.");
    
    if (matches.length > 0) {
      if (!window.confirm("CRÍTICO: Existen partidos registrados. Guardar un nuevo ranking alterará la composición de grupos y dejará los partidos previos inconsistentes. Debes auditar y/o eliminar los partidos afectados manualmente. ¿Continuar de todas formas?")) return;
    }
    
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'config', 'ranking'), { lol: rankLoL, valorant: rankVal });
      const logRef = doc(collection(db, 'audit_logs'));
      batch.set(logRef, { user: user.uid, timestamp: serverTimestamp(), action: 'UPDATE', collection: 'config', docId: 'ranking', oldData: rankingConfig, newData: { lol: rankLoL, valorant: rankVal } });
      await batch.commit();
      alert("Ranking guardado.");
    } catch { alert("Error guardando config."); }
  };

  const handleSubmitMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (game === 'lol' && !configCompleteLoL) return alert("Completa el ranking de LoL primero.");
    if (game === 'valorant' && !configCompleteVal) return alert("Completa el ranking de Valorant primero.");
    if (game === 'valorant' && phase === 'Fase de Grupos' && !valPreQualWinner) return alert("Finaliza la preclasificación de Valorant primero.");
    
    if (!teamA || !teamB || teamA === teamB) return alert("Facultades inválidas.");
    if (!winner) return alert("Selecciona un ganador válido.");

    if (phase === 'Fase de Grupos') {
      if (!availableFaculties.includes(teamA) || !availableFaculties.includes(teamB)) {
         return alert("Ambas facultades deben pertenecer al grupo seleccionado según el ranking histórico.");
      }
      if (game === 'valorant' && (teamA === valPreQualWinner || teamB === valPreQualWinner)) {
         return alert("El ganador de la preclasificación no puede jugar la Fase de Grupos (tiene Seed 1).");
      }
    }

    if (!editingId && matches.some(m => m.game === game && m.phase === phase && m.group === group && m.matchNumber === Number(matchNumber))) {
      return alert(`ERROR: El partido número ${matchNumber} ya existe para esta fase y grupo.`);
    }

    if (format === 'BO1') {
      if (game === 'lol' && winner !== teamA && winner !== teamB) return alert("Ganador de LoL inválido.");
      if (game === 'valorant' && !isWalkover) {
         if (Number(statA) === Number(statB)) return alert("Empate en rondas no permitido.");
         const exp = Number(statA) > Number(statB) ? teamA : teamB;
         if (winner !== exp) return alert("El ganador de Valorant no coincide con las rondas ingresadas.");
      }
    } else {
       const sA = Number(scoreA); const sB = Number(scoreB);
       if (![[2,0], [2,1], [1,2], [0,2]].some(s => s[0] === sA && s[1] === sB)) return alert("Resultado BO3 inválido.");
       const exp = sA > sB ? teamA : teamB;
       if (winner !== exp) return alert("El ganador seleccionado no coincide con la serie.");
    }

    let originalMatch = editingId ? matches.find(m => m.id === editingId) : null;
    
    // Dependency Validations
    if (originalMatch) {
       const isPrequalFinal = originalMatch.phase === 'Preclasificación - Final';
       const changedWinner = winner !== originalMatch.winner;
       if (isPrequalFinal && changedWinner && matches.some(m=>m.game==='valorant' && m.phase==='Fase de Grupos')) {
          if(!window.confirm(`ATENCIÓN: Cambiar el ganador de la Preclasificación invalidará los grupos de Valorant. Los registros posteriores que contienen a '${originalMatch.winner}' o '${winner}' en grupos quedarán corruptos. Debes eliminarlos. ¿Confirmar edición?`)) return;
       }
       if (originalMatch.phase.includes('Grupos') && changedWinner && matches.some(m=>m.game===game && m.phase.includes('Playoffs'))) {
          if(!window.confirm("ATENCIÓN: Modificar el resultado de este partido afectará la clasificación. Los cruces de playoffs ya generados pueden quedar con participantes inválidos. ¿Continuar?")) return;
       }
    }

    const matchData: any = {
      game, matchNumber: Number(matchNumber), phase, group: isPreQual ? '-' : group, 
      teamA, teamB, winner, isWalkover, format,
      updatedAt: serverTimestamp(), updatedBy: user.uid
    };
    
    if (format === 'BO1') {
      if (isWalkover && game === 'valorant') {
         matchData.statA = winner === teamA ? 13 : 0;
         matchData.statB = winner === teamB ? 13 : 0;
         matchData.duration = 40;
      } else if (isWalkover && game === 'lol') {
         matchData.statA = null; matchData.statB = null; matchData.duration = 30;
      } else {
         matchData.statA = Number(statA); matchData.statB = Number(statB); matchData.duration = Number(duration);
      }
    } else {
      matchData.scoreA = Number(scoreA); matchData.scoreB = Number(scoreB);
    }

    try {
      const batch = writeBatch(db);
      if (editingId) {
        const ref = doc(db, 'matches', editingId);
        batch.update(ref, matchData);
        logAudit(batch, 'UPDATE', editingId, originalMatch, matchData);
        await batch.commit();
        alert('Partida actualizada.'); setEditingId(null);
      } else {
        const ref = doc(collection(db, 'matches'));
        matchData.createdAt = serverTimestamp();
        batch.set(ref, matchData);
        logAudit(batch, 'CREATE', ref.id, null, matchData);
        await batch.commit();
        alert('Partida registrada.');
      }
      setStatA(''); setStatB(''); setScoreA(''); setScoreB(''); setDuration(''); setIsWalkover(false);
      setMatchNumber((Number(matchNumber)+1).toString());
    } catch { alert('Error guardando partido.'); }
  };

  const handleEdit = (m: MatchData) => {
    setEditingId(m.id || null); setGame(m.game); setMatchNumber(m.matchNumber.toString());
    setPhase(m.phase); setGroup(m.group); setTeamA(m.teamA); setTeamB(m.teamB);
    setWinner(m.winner); setIsWalkover(m.isWalkover);
    if (m.format === 'BO1') {
      setStatA(m.statA?.toString() || ''); setStatB(m.statB?.toString() || ''); setDuration(m.duration?.toString() || '');
    } else {
      setScoreA(m.scoreA?.toString() || ''); setScoreB(m.scoreB?.toString() || '');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (m: MatchData) => {
    if (m.phase === 'Preclasificación - Final' && matches.some(x => x.game === 'valorant' && x.phase === 'Fase de Grupos')) {
      if (!window.confirm("CRÍTICO: Borrar la final invalidará los grupos generados. ¿Seguro?")) return;
    }
    if (window.confirm('¿Seguro que deseas eliminar esta partida permanentemente? Se registrará en auditoría.')) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'matches', m.id!));
      logAudit(batch, 'DELETE', m.id!, m, null);
      await batch.commit();
    }
  };

  if (!user || !isAdminAuth) {
    return (
      <div className="card" style={{maxWidth: 400, margin: '50px auto'}}>
        <h2>Acceso Administrativo</h2>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Correo" onChange={e=>setEmail(e.target.value)} required/>
          <input type="password" placeholder="Contraseña" onChange={e=>setPass(e.target.value)} required/>
          <button className="btn" style={{width: '100%'}}>Ingresar</button>
        </form>
      </div>
    );
  }

  const pLoL = hasConfigData ? getLoLGroups(rankLoL) : null;
  const pVal = hasConfigData ? getValorantGroups(rankVal, valPreQualWinner) : null;

  return (
    <div>
      <div className="flex-between" style={{marginBottom: 20}}>
        <h2>Panel de Administración</h2>
        <button className="btn btn-danger" onClick={() => signOut(auth)}>Cerrar Sesión</button>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Gestión</button>
        <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>Configuración</button>
      </div>

      {activeTab === 'config' && (
        <div className="card" style={{animation: 'fadeIn 0.3s ease'}}>
          <h3>Configuración Histórica 2025</h3>
          <p style={{color: 'var(--text-muted)'}}>Requiere 10 en LoL y 9 en Valorant para habilitar registro.</p>
          <div className="grid-2">
            <div>
              <h4 style={{color: 'var(--lol-color)'}}>League of Legends</h4>
              {rankLoL.map((fac, i) => (
                <div key={i} className="config-row"><span>{i+1}.º</span>
                  <select value={fac} onChange={e => { const r = [...rankLoL]; r[i] = e.target.value; setRankLoL(r); }}>
                    <option value="">Vacío</option>
                    {LOL_FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
              {pLoL?.ready && <div style={{fontSize:'0.85rem', color:'var(--text-muted)', marginTop: 10}}>Grupo A: {pLoL.groupA.join(', ')}<br/>Grupo B: {pLoL.groupB.join(', ')}</div>}
            </div>
            <div>
              <h4 style={{color: 'var(--val-color)'}}>Valorant</h4>
              {rankVal.map((fac, i) => (
                <div key={i} className="config-row"><span>{i+1}.º</span>
                  <select value={fac} onChange={e => { const r = [...rankVal]; r[i] = e.target.value; setRankVal(r); }}>
                    <option value="">Vacío</option>
                    {VAL_FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
              {valPreQualWinner ? (
                pVal?.ready && <div style={{fontSize:'0.85rem', color:'var(--text-muted)', marginTop: 10}}>Grupo A: {pVal.groupA.join(', ')}<br/>Grupo B: {pVal.groupB.join(', ')}</div>
              ) : (
                <div style={{fontSize:'0.85rem', color:'var(--warning)', marginTop: 10}}>Grupos no definidos hasta finalizar Preclasificación.</div>
              )}
            </div>
          </div>
          <button className="btn btn-success" style={{marginTop: 20, width: '100%'}} onClick={handleSaveConfig}>Guardar</button>
        </div>
      )}

      {activeTab === 'matches' && (
        <>
          <div className="card" style={{animation: 'fadeIn 0.3s ease'}}>
            <h3>{editingId ? 'Editar Resultado' : 'Registrar Resultado'}</h3>
            <form onSubmit={handleSubmitMatch}>
              <div className="grid-3">
                <div><label>Modalidad</label><select value={game} onChange={e=>{setGame(e.target.value as any); setTeamA(''); setTeamB('');}}><option value="lol">League of Legends</option><option value="valorant">Valorant</option></select></div>
                <div>
                  <label>Fase</label>
                  <select value={phase} onChange={e=>setPhase(e.target.value)}>
                    <option>Fase de Grupos</option>
                    {game === 'valorant' && <><option>Preclasificación - Semifinal 1</option><option>Preclasificación - Semifinal 2</option><option>Preclasificación - Final</option><option>Playoffs - Clasificación Seed 4</option></>}
                    <option>Playoffs - Semifinal 1</option>
                    <option>Playoffs - Semifinal 2</option>
                    <option>Playoffs - 3er Puesto</option>
                    <option>Playoffs - Final</option>
                  </select>
                </div>
                <div><label>Nº Partido</label><input type="number" required value={matchNumber} onChange={e=>setMatchNumber(e.target.value)} /></div>
                
                <div>
                  <label>Grupo/Llave</label>
                  <select value={group} onChange={e=>{setGroup(e.target.value); setTeamA(''); setTeamB('');}} disabled={isPreQual || isPlayoffs}>
                    {isPreQual ? <option value="-">-</option> : isPlayoffs ? <option value="Playoffs">Playoffs</option> : <><option value="A">Grupo A</option><option value="B">Grupo B</option></>}
                  </select>
                </div>
                <div>
                  <label>Facultad A</label>
                  <select value={teamA} onChange={e=>setTeamA(e.target.value)} disabled={isPreQual || isPlayoffs} required>
                    <option value="">{isPreQual || isPlayoffs ? (teamA || 'Auto-completando...') : 'Seleccionar...'}</option>
                    {availableFaculties.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label>Facultad B</label>
                  <select value={teamB} onChange={e=>setTeamB(e.target.value)} disabled={isPreQual || isPlayoffs} required>
                    <option value="">{isPreQual || isPlayoffs ? (teamB || 'Auto-completando...') : 'Seleccionar...'}</option>
                    {availableFaculties.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                {format === 'BO1' ? (
                  <>
                    <div><label>{game === 'lol' ? 'Oro Final A' : 'Rondas A'}</label><input type="number" required={!isWalkover} disabled={isWalkover && game==='valorant'} value={statA} onChange={e=>setStatA(e.target.value)} /></div>
                    <div><label>{game === 'lol' ? 'Oro Final B' : 'Rondas B'}</label><input type="number" required={!isWalkover} disabled={isWalkover && game==='valorant'} value={statB} onChange={e=>setStatB(e.target.value)} /></div>
                    <div><label>Duración (minutos)</label><input type="number" required={!isWalkover} disabled={isWalkover} value={duration} onChange={e=>setDuration(e.target.value)} /></div>
                  </>
                ) : (
                   <>
                    <div><label>Puntos Serie A</label><input type="number" required value={scoreA} onChange={e=>setScoreA(e.target.value)} /></div>
                    <div><label>Puntos Serie B</label><input type="number" required value={scoreB} onChange={e=>setScoreB(e.target.value)} /></div>
                    <div/>
                   </>
                )}

                <div>
                  <label>Ganador</label>
                  <select value={winner} onChange={e=>setWinner(e.target.value)} required disabled={(game==='valorant' && format==='BO1' && !isWalkover) || format==='BO3'}>
                    <option value="">Seleccionar...</option>
                    {teamA && <option value={teamA}>{teamA}</option>}
                    {teamB && <option value={teamB}>{teamB}</option>}
                  </select>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                  <input type="checkbox" id="wo" style={{width: 'auto', margin: 0}} checked={isWalkover} onChange={e=>{setIsWalkover(e.target.checked); if(e.target.checked && game==='valorant'){ setStatA(''); setStatB(''); setDuration('');}}} />
                  <label htmlFor="wo">Victoria por WO</label>
                </div>
              </div>
              <div style={{marginTop: 20, display: 'flex', gap: 10}}>
                <button type="submit" className="btn btn-success">{editingId ? 'Guardar Cambios' : 'Registrar'}</button>
                {editingId && <button type="button" className="btn" onClick={() => setEditingId(null)}>Cancelar</button>}
              </div>
            </form>
          </div>

          <div className="card">
            <h3>Partidas Cargadas</h3>
            <table>
              <thead><tr><th>Nº</th><th>Fase</th><th>Grupo</th><th>Enfrentamiento</th><th>Ganador</th><th>Acciones</th></tr></thead>
              <tbody>
                {matches.map(m => (
                  <tr key={m.id}>
                    <td>{m.matchNumber}</td><td>{m.phase}</td><td>{m.group}</td><td>{m.teamA} vs {m.teamB}</td><td>{m.winner} {m.isWalkover && '(WO)'}</td>
                    <td>
                      <button className="btn" style={{padding:'5px 10px', fontSize:'0.8rem', marginRight:5}} onClick={() => handleEdit(m)}>Editar</button>
                      <button className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8rem'}} onClick={() => handleDelete(m)}>X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
