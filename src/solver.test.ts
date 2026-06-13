import { describe, expect, it } from 'vitest';
import { createDefaultBoard, createFullBoard } from './board';
import { solveInventory } from './solver';
import type { Board } from './types';

describe('solver', () => {
  it('returns zero when no items are provided', () => {
    const result = solveInventory(createDefaultBoard(), {}, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(0);
    expect(result.provenOptimal).toBe(true);
  });

  it('places a single-cell item on the default board', () => {
    const result = solveInventory(createDefaultBoard(), { P11: 1 }, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(1);
    expect(result.solutions[0].placements).toHaveLength(1);
  });

  it('does not return duplicate visual solutions for identical item copies', () => {
    const board: Board = [
      [true, true, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
    ];

    const result = solveInventory(board, { P11: 2 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(2);
    expect(result.solutions).toHaveLength(1);
  });

  it('fills a full board with single-cell items', () => {
    const result = solveInventory(createFullBoard(), { P11: 81 }, { timeLimitMs: 500 });
    expect(result.bestFilledCells).toBe(81);
  });

  it('handles items that cannot fit', () => {
    const result = solveInventory(createDefaultBoard(), { P15: 1 }, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(6);
  });

  it('considers mid-priority cross items in a time-limited dense inventory', () => {
    const board: Board = [
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true],
    ];

    const result = solveInventory(
      board,
      {
        P01: 5,
        P05: 1,
        P09: 3,
        P10: 1,
        P11: 1,
        P12: 2,
        P13: 1,
        P15: 2,
      },
      { maxSolutions: 3, timeLimitMs: 1000 },
    );

    expect(result.solutions.some((solution) => solution.placements.some((placement) => placement.itemId === 'P12'))).toBe(true);
  });
});
