export interface MatchData {
  id?: string;
  game: 'lol' | 'valorant';
  matchNumber: number;
  phase: string;
  group: string;
  teamA: string;
  teamB: string;
  winner: string;
  isWalkover: boolean;
  format: 'BO1' | 'BO3';
  
  duration?: number;
  statA?: number;
  statB?: number;
  scoreA?: number;
  scoreB?: number;

  createdAt: any;
  updatedAt?: any;
  updatedBy?: string;
}

export interface RankingConfig {
  lol: string[];
  valorant: string[];
}

export interface AuditLog {
  id?: string;
  user: string;
  timestamp: any;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  docId: string;
  oldData: any;
  newData: any;
}

export const LOL_FACULTIES = ['FACEN', 'POLITECNICA', 'AGRONOMIA', 'MEDICINA', 'DERECHO', 'ECONOMIA', 'INGENIERIA', 'VETERINARIA', 'QUIMICA', 'FADA'];
export const VAL_FACULTIES = ['FACEN', 'POLITECNICA', 'AGRONOMIA', 'DERECHO', 'ECONOMIA', 'INGENIERIA', 'VETERINARIA', 'QUIMICA', 'FADA'];
