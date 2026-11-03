import { MatchData } from '../types';

export const getLoLGroups = (ranking: string[]) => {
  const valid = ranking ? ranking.filter(Boolean) : [];
  if (valid.length !== 10 || new Set(valid).size !== 10) return { groupA: [], groupB: [], ready: false };
  return {
    groupA: [ranking[0], ranking[3], ranking[4], ranking[7], ranking[8]],
    groupB: [ranking[1], ranking[2], ranking[5], ranking[6], ranking[9]],
    ready: true
  };
};

export const getValorantPreQualWinner = (matches: MatchData[]) => {
  const finalMatch = matches.find(m => m.game === 'valorant' && m.phase === 'Preclasificación - Final');
  return finalMatch?.winner || null;
};

export const getValorantGroups = (ranking: string[], preQualWinner: string | null) => {
  const valid = ranking ? ranking.filter(Boolean) : [];
  if (valid.length !== 9 || new Set(valid).size !== 9) return { groupA: [], groupB: [], ready: false };
  if (!preQualWinner) return { groupA: [], groupB: [], ready: false };
  
  const remaining = valid.filter(t => t !== preQualWinner);
  if (remaining.length !== 8) return { groupA: [], groupB: [], ready: false };
  return {
    groupA: [remaining[0], remaining[3], remaining[4], remaining[7]],
    groupB: [remaining[1], remaining[2], remaining[5], remaining[6]],
    ready: true
  };
};
