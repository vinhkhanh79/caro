
import { Player } from '../types';
// Fix: GRID_SIZE is exported from constants.ts, not types.ts
import { GRID_SIZE } from '../constants';

export const checkWinner = (board: Player[][], r: number, c: number): [number, number][] | null => {
  const player = board[r][c];
  if (!player) return null;

  const directions = [
    [0, 1],  // Horizontal
    [1, 0],  // Vertical
    [1, 1],  // Diagonal \
    [1, -1], // Diagonal /
  ];

  for (const [dr, dc] of directions) {
    const line: [number, number][] = [[r, c]];
    
    // Check in positive direction
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc] === player) {
        line.push([nr, nc]);
      } else {
        break;
      }
    }

    // Check in negative direction
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i;
      const nc = c - dc * i;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc] === player) {
        line.push([nr, nc]);
      } else {
        break;
      }
    }

    if (line.length >= 5) {
      return line;
    }
  }

  return null;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
