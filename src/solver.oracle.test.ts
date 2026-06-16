import { describe, expect, it } from 'vitest';
import { buildPlacementCache, compareObjectiveScores, solveInventory } from './solver';
import { getSelectedItemArea } from './solverDiagnostics';
import { assertSolverResultIsLegal } from './solverTestUtils';
import type { Board, Placement } from './types';

type CandidateScore = {
  mustUseFilledArea: number;
  filledCells: number;
  unusedItemCount: number;
  signature: string;
};

type OracleResult = {
  bestFilledCells: number;
  mustUseFilledArea: number;
  mustUseSatisfied: boolean;
  mustUseUsedCounts: Record<string, number>;
  mustUseUnusedCounts: Record<string, number>;
  unusedItemCount: number;
  provenOptimal: true;
};

function normalizeCount(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
}

function cloneCounts(counts: Record<string, number>): Record<string, number> {
  return { ...counts };
}

function toPlacement(placement: {
  itemId: string;
  rotation: number;
  row: number;
  col: number;
  cells: Array<{ row: number; col: number }>;
}): Placement {
  return {
    itemId: placement.itemId,
    rotation: placement.rotation as 0 | 90 | 180 | 270,
    row: placement.row,
    col: placement.col,
    cells: placement.cells.map((c) => ({ ...c })),
  };
}

function oracleSolve(
  board: Board,
  counts: Record<string, number>,
  mustUseItemIds?: string[],
): OracleResult {
  const selectedCounts = Object.fromEntries(
    Object.entries(counts)
      .map(([id, c]) => [id, normalizeCount(c)] as const)
      .filter(([, c]) => c > 0),
  );
  const mustUseSet = new Set(mustUseItemIds ?? []);
  const cache = buildPlacementCache(board);
  const usableMask = buildUsableMask(board);

  let bestFilledCells = 0;
  let bestMustUseFilledArea = 0;
  let bestUnusedItemCount = Number.POSITIVE_INFINITY;
  let bestUsedCounts: Record<string, number> = {};

  const remainingCounts = cloneCounts(selectedCounts);
  const usedCounts: Record<string, number> = {};
  const placements: Placement[] = [];
  let nodes = 0;

  function currentUnusedItemCount(): number {
    return Object.entries(remainingCounts).reduce((sum, [, c]) => sum + c, 0);
  }

  function makeScore(filledCells: number, mustUseFilledArea: number): CandidateScore {
    return {
      mustUseFilledArea,
      filledCells,
      unusedItemCount: currentUnusedItemCount(),
      signature: '',
    };
  }

  function dfs(occupiedMask: bigint, filledCells: number, mustUseFilledArea: number): void {
    nodes += 1;

    const score = makeScore(filledCells, mustUseFilledArea);
    const bestScore: CandidateScore = {
      mustUseFilledArea: bestMustUseFilledArea,
      filledCells: bestFilledCells,
      unusedItemCount: bestUnusedItemCount,
      signature: '',
    };

    if (compareObjectiveScores(score, bestScore) < 0) {
      bestFilledCells = filledCells;
      bestMustUseFilledArea = mustUseFilledArea;
      bestUnusedItemCount = currentUnusedItemCount();
      bestUsedCounts = { ...usedCounts };
    }

    const freeMask = usableMask & ~occupiedMask;
    if (freeMask === 0n) return;

    let pivotIndex = -1;
    for (let i = 0; i < 81; i += 1) {
      if ((freeMask & (1n << BigInt(i))) !== 0n) {
        pivotIndex = i;
        break;
      }
    }
    if (pivotIndex === -1) return;

    const pivotPlacements = cache.placementsByCell[pivotIndex].filter(
      (p) => (remainingCounts[p.itemId] ?? 0) > 0 && (p.mask & occupiedMask) === 0n,
    );

    for (const cp of pivotPlacements) {
      const mustUseArea = mustUseSet.has(cp.itemId) ? cp.area : 0;

      remainingCounts[cp.itemId] -= 1;
      usedCounts[cp.itemId] = (usedCounts[cp.itemId] ?? 0) + 1;
      placements.push(toPlacement(cp));

      dfs(occupiedMask | cp.mask, filledCells + cp.area, mustUseFilledArea + mustUseArea);

      placements.pop();
      usedCounts[cp.itemId] -= 1;
      if (usedCounts[cp.itemId] === 0) {
        delete usedCounts[cp.itemId];
      }
      remainingCounts[cp.itemId] += 1;
    }

    dfs(occupiedMask | (1n << BigInt(pivotIndex)), filledCells, mustUseFilledArea);
  }

  dfs(0n, 0, 0);

  const allMustUseCounts: Record<string, number> = {};
  for (const itemId of [...mustUseSet]) {
    allMustUseCounts[itemId] = selectedCounts[itemId] ?? 0;
  }

  const mustUseUsedCounts: Record<string, number> = {};
  const mustUseUnusedCounts: Record<string, number> = {};
  for (const itemId of [...mustUseSet]) {
    const selected = selectedCounts[itemId] ?? 0;
    const used = bestUsedCounts[itemId] ?? 0;
    if (used > 0) {
      mustUseUsedCounts[itemId] = Math.min(used, selected);
    }
    const unused = Math.max(0, selected - used);
    if (unused > 0) {
      mustUseUnusedCounts[itemId] = unused;
    }
  }

  return {
    bestFilledCells,
    mustUseFilledArea: bestMustUseFilledArea,
    mustUseSatisfied: Object.keys(mustUseUnusedCounts).length === 0,
    mustUseUsedCounts,
    mustUseUnusedCounts,
    unusedItemCount: bestUnusedItemCount,
    provenOptimal: true,
  };
}

function bitFor(row: number, col: number): bigint {
  return 1n << BigInt(row * 9 + col);
}

function buildUsableMask(board: Board): bigint {
  let mask = 0n;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (board[row][col]) {
        mask |= bitFor(row, col);
      }
    }
  }
  return mask;
}

type OracleBoard = {
  name: string;
  board: Board;
};

const smallBoards: OracleBoard[] = [
  {
    name: '3x3',
    board: Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 9 }, (_, col) => row < 3 && col < 3),
    ),
  },
  {
    name: '4x4',
    board: Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 9 }, (_, col) => row < 4 && col < 4),
    ),
  },
];

type OracleItemSet = {
  name: string;
  items: string[];
  maxCounts: Record<string, number>;
};

const oracleItemSets: OracleItemSet[] = [
  {
    name: 'small items',
    items: ['P07', 'P08', 'P10', 'P11'],
    maxCounts: { P07: 1, P08: 1, P10: 2, P11: 2 },
  },
  {
    name: 'medium items',
    items: ['P05', 'P06', 'P07', 'P09'],
    maxCounts: { P05: 1, P06: 1, P07: 1, P09: 1 },
  },
  {
    name: 'mixed items',
    items: ['P02', 'P05', 'P06', 'P07', 'P09'],
    maxCounts: { P02: 1, P05: 1, P06: 1, P07: 1, P09: 1 },
  },
];

function generateCountCombinations(itemSet: OracleItemSet): Record<string, number>[] {
  const combinations: Record<string, number>[] = [];

  function recurse(idx: number, current: Record<string, number>) {
    if (idx >= itemSet.items.length) {
      if (Object.values(current).some((c) => c > 0)) {
        combinations.push({ ...current });
      }
      return;
    }
    const itemId = itemSet.items[idx];
    const maxCount = itemSet.maxCounts[itemId] ?? 1;
    for (let c = 0; c <= maxCount; c += 1) {
      recurse(idx + 1, { ...current, [itemId]: c });
    }
  }

  recurse(0, {});
  return combinations;
}

describe('solver oracle', () => {
  for (const ob of smallBoards) {
    for (const itemSet of oracleItemSets) {
      const combinations = generateCountCombinations(itemSet);
      const maxCombinations = Math.min(combinations.length, 200);
      const subset = combinations.slice(0, maxCombinations);

      it(`matches oracle on ${ob.name} board with ${itemSet.name} (${subset.length} combinations)`, () => {
        for (const counts of subset) {
          const selectedArea = getSelectedItemArea(counts);
          if (selectedArea === 0) continue;

          const solverResult = solveInventory(ob.board, counts, {
            maxSolutions: 1,
            timeLimitMs: 2000,
          });

          assertSolverResultIsLegal(ob.board, counts, solverResult);

          const oracleResult = oracleSolve(ob.board, counts);

          expect(solverResult.bestFilledCells).toBe(oracleResult.bestFilledCells);
          expect(solverResult.mustUseSatisfied).toBe(oracleResult.mustUseSatisfied);
        }
      });

      it(`matches oracle with must-use on ${ob.name} board with ${itemSet.name} (${subset.length} combinations)`, () => {
        for (const counts of subset) {
          const selectedArea = getSelectedItemArea(counts);
          if (selectedArea === 0) continue;

          const availableItems = Object.entries(counts).filter(([, c]) => c > 0).map(([id]) => id);
          if (availableItems.length === 0) continue;

          const mustUseItemIds = [availableItems[0]];

          const solverResult = solveInventory(ob.board, counts, {
            maxSolutions: 1,
            timeLimitMs: 2000,
            mustUseItemIds,
          });

          assertSolverResultIsLegal(ob.board, counts, solverResult);

          const oracleResult = oracleSolve(ob.board, counts, mustUseItemIds);

          expect(solverResult.bestFilledCells).toBe(oracleResult.bestFilledCells);
          expect(solverResult.mustUseSatisfied).toBe(oracleResult.mustUseSatisfied);
          expect(solverResult.mustUseUsedCounts).toEqual(oracleResult.mustUseUsedCounts);
        }
      });
    }
  }
});
