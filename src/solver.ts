import { countUsableCells, BOARD_SIZE } from './board';
import { items } from './items';
import type { Board, CandidateSolution, Cell, Placement, Shape, SolverOptions, SolverResult } from './types';

type PieceInstance = {
  itemId: string;
  shapes: Shape[];
  area: number;
};

const defaultOptions: Required<Pick<SolverOptions, 'maxSolutions' | 'timeLimitMs'>> = {
  maxSolutions: 8,
  timeLimitMs: 1000,
};

function cellIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

function bitFor(row: number, col: number): bigint {
  return 1n << BigInt(cellIndex(row, col));
}

function buildUsableMask(board: Board): bigint {
  let mask = 0n;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col]) {
        mask |= bitFor(row, col);
      }
    }
  }

  return mask;
}

function countBits(value: bigint): number {
  let count = 0;
  let current = value;

  while (current > 0n) {
    current &= current - 1n;
    count += 1;
  }

  return count;
}

function absoluteCells(shape: Shape, row: number, col: number): Cell[] {
  return shape.cells.map((cell) => ({ row: row + cell.row, col: col + cell.col }));
}

function placementMask(shape: Shape, row: number, col: number): bigint {
  return shape.cells.reduce((mask, cell) => mask | bitFor(row + cell.row, col + cell.col), 0n);
}

function normalizeCount(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
}

function normalizePriority(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(5, Math.max(1, Math.floor(value)));
}

function collectPieceInstances(counts: Record<string, number>): PieceInstance[] {
  const itemTypes = items
    .map((item) => ({
      itemId: item.id,
      shapes: item.rotations,
      area: item.rotations[0]?.area ?? 0,
      count: normalizeCount(counts[item.id]),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.area - a.area || a.itemId.localeCompare(b.itemId));

  const maxCount = Math.max(0, ...itemTypes.map((item) => item.count));
  const pieces: PieceInstance[] = [];

  for (let copyIndex = 0; copyIndex < maxCount; copyIndex += 1) {
    itemTypes.forEach((item) => {
      if (copyIndex < item.count) {
        pieces.push({
          itemId: item.itemId,
          shapes: item.shapes,
          area: item.area,
        });
      }
    });
  }

  return pieces;
}

function remainingAreaSuffix(pieces: PieceInstance[]): number[] {
  const suffix = Array.from({ length: pieces.length + 1 }, () => 0);
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    suffix[index] = suffix[index + 1] + pieces[index].area;
  }
  return suffix;
}

function candidateSignature(candidate: CandidateSolution): string {
  return candidate.placements
    .flatMap((placement) => placement.cells.map((cell) => `${cell.row},${cell.col}:${placement.itemId}`))
    .sort()
    .join('|');
}

function addCandidate(candidates: CandidateSolution[], candidate: CandidateSolution, maxSolutions: number) {
  const signature = candidateSignature(candidate);

  if (
    candidates.some(
      (existing) => existing.filledCells === candidate.filledCells && candidateSignature(existing) === signature,
    )
  ) {
    return;
  }

  candidates.push({
    filledCells: candidate.filledCells,
    placements: candidate.placements.map((placement) => ({
      ...placement,
      cells: placement.cells.map((cell) => ({ ...cell })),
    })),
  });

  candidates.sort((a, b) => b.filledCells - a.filledCells || a.placements.length - b.placements.length);
  candidates.splice(maxSolutions);
}

function getSelectedCounts(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    items
      .map((item) => [item.id, normalizeCount(counts[item.id])] as const)
      .filter(([, count]) => count > 0),
  );
}

function getUsedCounts(solution: CandidateSolution | undefined): Record<string, number> {
  const usedCounts: Record<string, number> = {};

  solution?.placements.forEach((placement) => {
    usedCounts[placement.itemId] = (usedCounts[placement.itemId] ?? 0) + 1;
  });

  return usedCounts;
}

function getUnusedCounts(
  selectedCounts: Record<string, number>,
  usedCounts: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(selectedCounts)
      .map(([itemId, count]) => [itemId, Math.max(0, count - (usedCounts[itemId] ?? 0))] as const)
      .filter(([, count]) => count > 0),
  );
}

function getItemArea(itemId: string): number {
  return items.find((item) => item.id === itemId)?.rotations[0]?.area ?? 0;
}

function getItemPriority(itemId: string, priorityByItemId: Record<string, number> | undefined): number {
  return normalizePriority(priorityByItemId?.[itemId]);
}

function getCountsArea(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((total, [itemId, count]) => total + getItemArea(itemId) * count, 0);
}

function getPriorityScore(
  usedCounts: Record<string, number>,
  priorityByItemId: Record<string, number> | undefined,
): number {
  return Object.entries(usedCounts).reduce(
    (total, [itemId, usedCount]) => total + getItemArea(itemId) * getItemPriority(itemId, priorityByItemId) * usedCount,
    0,
  );
}

function getMustUseCounts(
  counts: Record<string, number>,
  usedCounts: Record<string, number>,
  mustUseItemIds: string[] | undefined,
): { used: Record<string, number>; unused: Record<string, number> } {
  const mustUseIds = [...new Set(mustUseItemIds ?? [])];
  const used: Record<string, number> = {};
  const unused: Record<string, number> = {};

  mustUseIds.forEach((itemId) => {
    const selected = counts[itemId] ?? 0;
    const placed = Math.min(selected, usedCounts[itemId] ?? 0);
    const missing = Math.max(0, selected - placed);

    if (placed > 0) {
      used[itemId] = placed;
    }

    if (missing > 0) {
      unused[itemId] = missing;
    }
  });

  return { used, unused };
}

export function solveInventory(
  board: Board,
  counts: Record<string, number>,
  options: SolverOptions = {},
): SolverResult {
  const settings = { ...defaultOptions, ...options };
  const start = performance.now();
  const usableMask = buildUsableMask(board);
  const usableCells = countUsableCells(board);
  const selectedCounts = getSelectedCounts(counts);
  const selectedItemArea = getCountsArea(selectedCounts);
  const pieces = collectPieceInstances(counts);
  const remainingArea = remainingAreaSuffix(pieces);
  const candidates: CandidateSolution[] = [];
  const placements: Placement[] = [];

  let bestFilledCells = 0;
  let searchedNodes = 0;
  let timedOut = false;

  function remember(score: number) {
    if (score < bestFilledCells) {
      return;
    }

    if (score > bestFilledCells) {
      bestFilledCells = score;
      candidates.length = 0;
    }

    addCandidate(candidates, { filledCells: score, placements }, settings.maxSolutions);
  }

  function dfs(pieceIndex: number, occupiedMask: bigint, score: number): void {
    searchedNodes += 1;

    if ((searchedNodes & 255) === 0 && performance.now() - start > settings.timeLimitMs) {
      timedOut = true;
      return;
    }

    const freeCells = countBits(usableMask & ~occupiedMask);
    if (score + Math.min(freeCells, remainingArea[pieceIndex]) < bestFilledCells) {
      return;
    }

    remember(score);

    if (pieceIndex >= pieces.length || freeCells === 0) {
      return;
    }

    const piece = pieces[pieceIndex];

    for (const shape of piece.shapes) {
      for (let row = 0; row <= BOARD_SIZE - shape.height; row += 1) {
        for (let col = 0; col <= BOARD_SIZE - shape.width; col += 1) {
          const mask = placementMask(shape, row, col);

          if ((mask & usableMask) !== mask || (mask & occupiedMask) !== 0n) {
            continue;
          }

          placements.push({
            itemId: piece.itemId,
            rotation: shape.rotation,
            row,
            col,
            cells: absoluteCells(shape, row, col),
          });
          dfs(pieceIndex + 1, occupiedMask | mask, score + shape.area);
          placements.pop();

          if (timedOut) {
            return;
          }
        }
      }
    }

    dfs(pieceIndex + 1, occupiedMask, score);
  }

  dfs(0, 0n, 0);

  const bestSolution = candidates[0];
  const usedCounts = getUsedCounts(bestSolution);
  const unusedCounts = getUnusedCounts(selectedCounts, usedCounts);
  const mustUseCounts = getMustUseCounts(selectedCounts, usedCounts, options.mustUseItemIds);
  const targetFilledCells = Math.min(selectedItemArea, usableCells);
  const placedItemArea = bestFilledCells;

  return {
    bestFilledCells,
    usableCells,
    utilization: usableCells === 0 ? 0 : bestFilledCells / usableCells,
    solutions: candidates,
    selectedItemArea,
    placedItemArea,
    selectedPlacementRatio: selectedItemArea === 0 ? 0 : placedItemArea / selectedItemArea,
    usedCounts,
    unusedCounts,
    priorityScore: getPriorityScore(usedCounts, options.priorityByItemId),
    mustUseSatisfied: Object.keys(mustUseCounts.unused).length === 0,
    mustUseUsedCounts: mustUseCounts.used,
    mustUseUnusedCounts: mustUseCounts.unused,
    targetFilledCells,
    provenOptimal: !timedOut,
    stopReason: timedOut ? 'time-limit' : 'complete',
    searchedNodes,
  };
}
