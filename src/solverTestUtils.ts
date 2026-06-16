import { expect } from 'vitest';
import type { Board, SolverOptions, SolverResult } from './types';
import { items } from './items';

function normalizeCount(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
}

function getItemArea(itemId: string): number {
  return items.find((item) => item.id === itemId)?.rotations[0]?.area ?? 0;
}

export function getSelectedItemAreaFromCounts(counts: Record<string, number>): number {
  return Object.entries(counts).reduce(
    (total, [itemId, count]) => total + getItemArea(itemId) * normalizeCount(count),
    0,
  );
}

export function assertSolverResultIsLegal(
  board: Board,
  counts: Record<string, number>,
  result: SolverResult,
  options?: SolverOptions,
): void {
  expect(result.bestFilledCells).toBeLessThanOrEqual(result.usableCells);

  expect(result.placedItemArea).toBe(result.bestFilledCells);

  const expectedArea = getSelectedItemAreaFromCounts(counts);
  expect(result.selectedItemArea).toBe(expectedArea);

  expect(result.targetFilledCells).toBe(
    Math.min(result.selectedItemArea, result.usableCells),
  );

  const maxSolutions = options?.maxSolutions ?? 8;
  expect(result.solutions.length).toBeLessThanOrEqual(maxSolutions);

  const usableCellsSet = new Set(
    board.flatMap((rowCells, row) =>
      rowCells.flatMap((available, col) => (available ? [`${row},${col}`] : [])),
    ),
  );

  for (const solution of result.solutions) {
    const occupiedCells = new Set<string>();
    for (const placement of solution.placements) {
      for (const cell of placement.cells) {
        const key = `${cell.row},${cell.col}`;
        expect(usableCellsSet.has(key)).toBe(true);
        expect(occupiedCells.has(key)).toBe(false);
        occupiedCells.add(key);
      }
    }
    expect(solution.filledCells).toBe(
      solution.placements.reduce((sum, p) => sum + p.cells.length, 0),
    );
  }

  const selectedCounts = Object.fromEntries(
    Object.entries(counts)
      .map(([id, c]) => [id, normalizeCount(c)] as const)
      .filter(([, c]) => c > 0),
  );

  for (const [itemId, usedCount] of Object.entries(result.usedCounts)) {
    expect(usedCount).toBeLessThanOrEqual(selectedCounts[itemId] ?? 0);
  }

  const allReferencedIds = new Set([
    ...Object.keys(result.usedCounts),
    ...Object.keys(result.unusedCounts),
    ...Object.keys(selectedCounts),
  ]);
  for (const itemId of allReferencedIds) {
    const selected = selectedCounts[itemId] ?? 0;
    const used = result.usedCounts[itemId] ?? 0;
    const unused = result.unusedCounts[itemId] ?? 0;
    expect(used + unused).toBe(selected);
  }

  if (result.mustUseSatisfied) {
    for (const itemId of options?.mustUseItemIds ?? []) {
      expect(result.mustUseUnusedCounts[itemId] ?? 0).toBe(0);
    }
  }

  const mustUseAllIds = new Set([
    ...Object.keys(result.mustUseUsedCounts),
    ...Object.keys(result.mustUseUnusedCounts),
  ]);
  for (const itemId of mustUseAllIds) {
    const selected = selectedCounts[itemId] ?? 0;
    const used = result.mustUseUsedCounts[itemId] ?? 0;
    const unused = result.mustUseUnusedCounts[itemId] ?? 0;
    expect(used + unused).toBe(selected);
  }

  for (const solution of result.solutions) {
    expect(solution.filledCells).toBeLessThanOrEqual(result.bestFilledCells);
  }
}
