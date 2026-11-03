import { MatchData } from '../types';

// H2H Helper
function getH2HWins(team: string, tiedTeams: string[], groupMatches: MatchData[]) {
  let wins = 0;
  tiedTeams.forEach(opponent => {
    if (team === opponent) return;
    const match = groupMatches.find(m => 
      (m.teamA === team && m.teamB === opponent) || 
      (m.teamA === opponent && m.teamB === team)
    );
    if (match && match.winner === team) wins++;
  });
  return wins;
}

interface TiebreakerRule {
  name: string;
  getValue: (stat: any, tiedSubset: string[], matches: MatchData[]) => number;
  descending: boolean;
  resetRules?: TiebreakerRule[]; 
}

function resolveTies(teams: any[], matches: MatchData[], rules: TiebreakerRule[]): any[] {
  if (teams.length <= 1) return teams;
  if (rules.length === 0) {
    teams.forEach(t => t.pendingResolution = true);
    return teams;
  }

  const rule = rules[0];
  const nextRules = rules.slice(1);
  const subsetNames = teams.map(t => t.team);

  teams.forEach(t => { t._currentMetric = rule.getValue(t, subsetNames, matches); });

  const groups = new Map<number, any[]>();
  teams.forEach(t => {
    const val = t._currentMetric;
    if (!groups.has(val)) groups.set(val, []);
    groups.get(val)!.push(t);
  });

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => rule.descending ? b - a : a - b);

  if (sortedKeys.length === 1) {
    return resolveTies(teams, matches, nextRules);
  }

  let resolved: any[] = [];
  for (const key of sortedKeys) {
    const subgroup = groups.get(key)!;
    resolved = resolved.concat(resolveTies(subgroup, matches, rule.resetRules || nextRules));
  }
  return resolved;
}

export const calculateLoLStandings = (matches: MatchData[], phase: string, group: string, initialTeams: string[]) => {
  const groupMatches = matches.filter(m => m.phase === phase && m.group === group && m.format === 'BO1');
  const stats: Record<string, any> = {};
  
  if (!initialTeams || initialTeams.length === 0) return [];
  initialTeams.forEach(team => {
    stats[team] = { team, played: 0, wins: 0, losses: 0, totalGoldDiff: 0, totalWinTime: 0, walkoverWins: 0, regularGoldDiffs: [] };
  });

  // Calculate base stats and track non-WO gold differences
  groupMatches.forEach(m => {
    if (stats[m.teamA]) stats[m.teamA].played++; 
    if (stats[m.teamB]) stats[m.teamB].played++;
    
    if (m.winner === m.teamA && stats[m.teamA]) {
      stats[m.teamA].wins++; 
      if (stats[m.teamB]) stats[m.teamB].losses++;
      if (m.isWalkover) {
        stats[m.teamA].walkoverWins++; 
        stats[m.teamA].totalWinTime += 30;
      } else {
        const diff = (m.statA || 0) - (m.statB || 0);
        stats[m.teamA].regularGoldDiffs.push(diff);
        stats[m.teamA].totalGoldDiff += diff;
        if (stats[m.teamB]) stats[m.teamB].totalGoldDiff -= diff;
        stats[m.teamA].totalWinTime += (m.duration || 0);
      }
    } else if (m.winner === m.teamB && stats[m.teamB]) {
      stats[m.teamB].wins++; 
      if (stats[m.teamA]) stats[m.teamA].losses++;
      if (m.isWalkover) {
        stats[m.teamB].walkoverWins++; 
        stats[m.teamB].totalWinTime += 30;
      } else {
        const diff = (m.statB || 0) - (m.statA || 0);
        stats[m.teamB].regularGoldDiffs.push(diff);
        stats[m.teamB].totalGoldDiff += diff;
        if (stats[m.teamA]) stats[m.teamA].totalGoldDiff -= diff;
        stats[m.teamB].totalWinTime += (m.duration || 0);
      }
    }
  });

  // Apply average gold diff for walkovers based on ALL regular matches played by the team
  Object.values(stats).forEach(stat => {
    if (stat.walkoverWins > 0) {
      const avg = stat.regularGoldDiffs.length > 0 
        ? stat.regularGoldDiffs.reduce((a:number, b:number) => a + b, 0) / stat.regularGoldDiffs.length 
        : 0;
      stat.totalGoldDiff += (avg * stat.walkoverWins);
      
      // As per rule request: update loser of WO
      groupMatches.forEach(m => {
        if (m.isWalkover && m.winner === stat.team) {
           const loser = m.teamA === stat.team ? m.teamB : m.teamA;
           if (stats[loser]) stats[loser].totalGoldDiff -= avg;
        }
      });
    }
  });

  const lolRules: TiebreakerRule[] = [
    { name: 'H2H', getValue: (t, subset) => getH2HWins(t.team, subset, groupMatches), descending: true },
    { name: 'GoldDiff', getValue: (t) => t.totalGoldDiff, descending: true },
    { name: 'WinTime', getValue: (t) => t.totalWinTime, descending: false }
  ];
  lolRules[0].resetRules = lolRules;
  lolRules[1].resetRules = lolRules;
  lolRules[2].resetRules = lolRules;

  const teamsArray = Object.values(stats);
  const byWins = new Map<number, any[]>();
  teamsArray.forEach(t => {
    if (!byWins.has(t.wins)) byWins.set(t.wins, []);
    byWins.get(t.wins)!.push(t);
  });

  const sortedWins = Array.from(byWins.keys()).sort((a,b) => b - a);
  let finalStandings: any[] = [];
  for (const winCount of sortedWins) {
    const tiedGroup = byWins.get(winCount)!;
    finalStandings = finalStandings.concat(resolveTies(tiedGroup, groupMatches, lolRules));
  }
  return finalStandings;
};

export const calculateValorantStandings = (matches: MatchData[], phase: string, group: string, initialTeams: string[]) => {
  const groupMatches = matches.filter(m => m.phase === phase && m.group === group && m.format === 'BO1');
  const stats: Record<string, any> = {};
  
  if (!initialTeams || initialTeams.length === 0) return [];
  initialTeams.forEach(team => {
    stats[team] = { team, played: 0, wins: 0, losses: 0, roundDiff: 0, roundsWon: 0, winTime: 0, isTiedExtraMatch: false };
  });

  groupMatches.forEach(m => {
    if (stats[m.teamA]) stats[m.teamA].played++; 
    if (stats[m.teamB]) stats[m.teamB].played++;
    
    if (m.winner === m.teamA && stats[m.teamA]) {
      stats[m.teamA].wins++; 
      if (stats[m.teamB]) stats[m.teamB].losses++;
      if (m.isWalkover) {
        stats[m.teamA].roundDiff += 6; 
        stats[m.teamA].roundsWon += 13; 
        stats[m.teamA].winTime += 40;
        if (stats[m.teamB]) stats[m.teamB].roundDiff -= 6;
      } else {
        const diff = (m.statA || 0) - (m.statB || 0);
        stats[m.teamA].roundDiff += diff; 
        stats[m.teamA].roundsWon += (m.statA || 0); 
        stats[m.teamA].winTime += (m.duration || 0);
        if (stats[m.teamB]) {
          stats[m.teamB].roundDiff -= diff;
          stats[m.teamB].roundsWon += (m.statB || 0);
        }
      }
    } else if (m.winner === m.teamB && stats[m.teamB]) {
      stats[m.teamB].wins++; 
      if (stats[m.teamA]) stats[m.teamA].losses++;
      if (m.isWalkover) {
        stats[m.teamB].roundDiff += 6; 
        stats[m.teamB].roundsWon += 13; 
        stats[m.teamB].winTime += 40;
        if (stats[m.teamA]) stats[m.teamA].roundDiff -= 6;
      } else {
        const diff = (m.statB || 0) - (m.statA || 0);
        stats[m.teamB].roundDiff += diff; 
        stats[m.teamB].roundsWon += (m.statB || 0); 
        stats[m.teamB].winTime += (m.duration || 0);
        if (stats[m.teamA]) {
           stats[m.teamA].roundDiff -= diff;
           stats[m.teamA].roundsWon += (m.statA || 0);
        }
      }
    }
  });

  Object.values(stats).forEach(t => { t.avgWinTime = t.wins > 0 ? t.winTime / t.wins : 0; });

  const valRules: TiebreakerRule[] = [
    { name: 'H2H', getValue: (t, subset) => getH2HWins(t.team, subset, groupMatches), descending: true },
    { name: 'RoundDiff', getValue: (t) => t.roundDiff, descending: true },
    { name: 'RoundsWon', getValue: (t) => t.roundsWon, descending: true },
    { name: 'AvgWinTime', getValue: (t) => t.avgWinTime, descending: false }
  ];
  valRules.forEach(r => r.resetRules = valRules);

  const teamsArray = Object.values(stats);
  const byWins = new Map<number, any[]>();
  teamsArray.forEach(t => {
    if (!byWins.has(t.wins)) byWins.set(t.wins, []);
    byWins.get(t.wins)!.push(t);
  });

  const sortedWins = Array.from(byWins.keys()).sort((a,b) => b - a);
  let finalStandings: any[] = [];

  for (const winCount of sortedWins) {
    const tiedGroup = byWins.get(winCount)!;
    finalStandings = finalStandings.concat(resolveTies(tiedGroup, groupMatches, valRules));
  }

  // Flag unresolved ties for UI (Requires extra match or coin toss)
  finalStandings.forEach(t => {
     if (t.pendingResolution) t.isTiedExtraMatch = true;
  });

  return finalStandings;
};
