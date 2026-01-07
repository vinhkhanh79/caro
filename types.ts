
export type Player = 'X' | 'O' | null;
export type GameMode = 'ai' | 'pvp';

export interface GameState {
  board: Player[][];
  currentPlayer: Player;
  winner: Player;
  winningLine: [number, number][] | null;
  status: 'betting' | 'playing' | 'finished';
  currentBet: number;
  mode: GameMode;
}

export interface UserProfile {
  id: string;
  username: string;
  password?: string; // Chỉ dùng để lưu trữ local
  balance: number;
  avatar: string;
  gamesPlayed: number;
  gamesWon: number;
  totalEarned: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'win' | 'loss' | 'bet' | 'withdraw';
  amount: number;
  timestamp: Date;
}
