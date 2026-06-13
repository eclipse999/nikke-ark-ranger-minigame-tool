import { describe, expect, it } from 'vitest';
import { inferItemCountsFromOccupiedGrid } from './screenshotImport';

function emptyGrid(): boolean[][] {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => false));
}

function fill(grid: boolean[][], cells: Array<[number, number]>) {
  cells.forEach(([row, col]) => {
    grid[row][col] = true;
  });
}

describe('screenshot import', () => {
  it('infers item counts from an occupied grid', () => {
    const grid = emptyGrid();
    fill(grid, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [3, 3],
      [4, 3],
      [5, 3],
    ]);

    const result = inferItemCountsFromOccupiedGrid(grid);

    expect(result.uncoveredCells).toBe(0);
    expect(result.counts.P07).toBe(1);
    expect(result.counts.P09).toBe(1);
  });

  it('prefers known larger shapes over single-cell fallbacks', () => {
    const grid = emptyGrid();
    fill(grid, [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ]);

    const result = inferItemCountsFromOccupiedGrid(grid);

    expect(result.uncoveredCells).toBe(0);
    expect(result.counts.P12).toBe(1);
    expect(result.counts.P11).toBe(0);
  });
});

