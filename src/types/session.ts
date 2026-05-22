export type GoalType = 'killsAssists' | 'cs' | 'multikill' | 'killstreak' | 'win';
export type SessionPhase = 'lobby' | 'active';

export interface Goal {
  id: string;
  playerId: string;
  type: GoalType;
  description: string;
  championId: string;
  completed: boolean;
  unlockChampionId: string | null;
  unlockForPlayerId: string | null;
}

export interface PlayerState {
  id: string;
  name: string;
  unlockedChampionIds: string[];
}

export interface SessionState {
  sessionId: string;
  phase: SessionPhase;
  hostId: string | null;
  maxPlayers: number;
  players: PlayerState[];
  goals: Goal[];
  unlockedChampionIds: string[];
  lockedChampionIds: string[];
  lastUpdated: number;
}
