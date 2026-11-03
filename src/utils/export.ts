import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatchData } from '../types';

export const exportToPDF = (matches: MatchData[], standingsA: any[], standingsB: any[], game: string) => {
  const doc = new jsPDF();
  const title = `Resultados y Clasificacion - ${game.toUpperCase()} - JJUU 2026`;
  
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(12);
  doc.text('Grupo A', 14, 25);
  
  const colsA = game === 'lol' 
    ? [['Pos', 'Facultad', 'PJ', 'V', 'D', 'Dif. Oro', 'Tiempo (min)']]
    : [['Pos', 'Facultad', 'PJ', 'V', 'D', 'Dif. Rondas', 'Rondas Ganadas', 'Prom. Tiempo (min)']];
    
  const dataA = standingsA.map((s, i) => game === 'lol' 
    ? [i+1, s.team, s.played, s.wins, s.losses, Math.round(s.totalGoldDiff), Math.round(s.totalWinTime)]
    : [i+1, s.team, s.played, s.wins, s.losses, s.roundDiff, s.roundsWon, Math.round(s.avgWinTime)]
  );
  
  autoTable(doc, { head: colsA, body: dataA, startY: 30 });
  
  let finalY = (doc as any).lastAutoTable.finalY;
  doc.text('Grupo B', 14, finalY + 10);
  
  const dataB = standingsB.map((s, i) => game === 'lol' 
    ? [i+1, s.team, s.played, s.wins, s.losses, Math.round(s.totalGoldDiff), Math.round(s.totalWinTime)]
    : [i+1, s.team, s.played, s.wins, s.losses, s.roundDiff, s.roundsWon, Math.round(s.avgWinTime)]
  );
  
  autoTable(doc, { head: colsA, body: dataB, startY: finalY + 15 });
  
  finalY = (doc as any).lastAutoTable.finalY;
  
  doc.addPage();
  doc.text('Partidos Registrados', 14, 15);
  
  const matchCols = [['Nº', 'Fase', 'Grupo', 'Enfrentamiento', 'Resultado', 'Ganador']];
  const matchData = matches.map(m => {
    const format = m.format === 'BO1' ? (game === 'lol' ? `${m.statA||0} - ${m.statB||0}` : `${m.statA||0} - ${m.statB||0}`) : `Serie: ${m.scoreA||0} - ${m.scoreB||0}`;
    return [m.matchNumber, m.phase, m.group, `${m.teamA} vs ${m.teamB}`, `${format} ${m.isWalkover ? '(WO)' : ''}`, m.winner];
  });
  
  autoTable(doc, { head: matchCols, body: matchData, startY: 20 });
  doc.save(`${game}_resultados_jjuu2026.pdf`);
};

export const exportToCSV = (matches: MatchData[], game: string) => {
  const escapeCSV = (val: any) => `"${String(val).replace(/"/g, '""')}"`;
  const headers = ['ID', 'Numero', 'Fase', 'Grupo', 'EquipoA', 'EquipoB', 'Ganador', 'WO', 'Formato', 'StatA', 'StatB', 'Duracion', 'ScoreA', 'ScoreB'].map(escapeCSV).join(',');
  
  const rows = matches.map(m => 
    [m.id, m.matchNumber, m.phase, m.group, m.teamA, m.teamB, m.winner, m.isWalkover, m.format, m.statA||0, m.statB||0, m.duration||0, m.scoreA||0, m.scoreB||0].map(escapeCSV).join(',')
  );
  
  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${game}_matches.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToJSON = (matches: MatchData[], game: string) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(matches, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `${game}_matches.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
