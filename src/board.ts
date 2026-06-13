import type { Board } from './types';

export const BOARD_SIZE = 9;

const defaultRows = [
  'xxxxxxxxx',
  'xxxxxxxxx',
  'xxx...xxx',
  'xxx...xxx',
  'xxx...xxx',
  'xxx...xxx',
  'xxx...xxx',
  'xxxxxxxxx',
  'xxxxxxxxx',
];

export function createDefaultBoard(): Board {
  return defaultRows.map((row) => [...row].map((cell) => cell === '.'));
}

export function createFullBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => true));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function countUsableCells(board: Board): number {
  return board.reduce((total, row) => total + row.filter(Boolean).length, 0);
}
