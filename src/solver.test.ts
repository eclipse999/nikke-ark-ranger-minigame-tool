import { describe, expect, it } from 'vitest';
import { createDefaultBoard, createFullBoard } from './board';
import { solveInventory } from './solver';

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

  it('fills a full board with single-cell items', () => {
    const result = solveInventory(createFullBoard(), { P11: 81 }, { timeLimitMs: 500 });
    expect(result.bestFilledCells).toBe(81);
  });

  it('handles items that cannot fit', () => {
    const result = solveInventory(createDefaultBoard(), { P15: 1 }, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(6);
  });
});
