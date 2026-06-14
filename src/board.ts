import type { Board } from './types';
import { backpackPresets, type BackpackPresetId } from './backpackPresets';

export const BOARD_SIZE = 9;

export function createDefaultBoard(presetId: BackpackPresetId = 'character-1'): Board {
  const preset = backpackPresets.find((entry) => entry.id === presetId && entry.enabled) ?? backpackPresets[0];
  return preset.rows.map((row) => [...row].map((cell) => cell === '.'));
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
