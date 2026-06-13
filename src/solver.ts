import { countUsableCells, BOARD_SIZE } from './board';
import { items } from './items';
import type { Board, CandidateSolution, Cell, Placement, Shape, SolverOptions, SolverResult } from './types';

type ItemSearchEntry = {
  itemId: string;
  area: number;
  count: number;
};

type CandidateScore = {
  mustUseFilledArea: number;
  priorityScore: number;
  filledCells: number;
  unusedItemCount: number;
  signature: string;
};

type ScoredCandidate = {
  solution: CandidateSolution;
  score: CandidateScore;
};

export type CachedPlacement = Placement & {
  shapeIndex: number;
  area: number;
  mask: bigint;
};

export type PlacementCache = {
  placements: CachedPlacement[];
  placementsByItemId: Map<string, CachedPlacement[]>;
  placementsByCell: CachedPlacement[][];
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

function bitForIndex(index: number): bigint {
  return 1n << BigInt(index);
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

function toPlacement(placement: CachedPlacement): Placement {
  return {
    itemId: placement.itemId,
    rotation: placement.rotation,
    row: placement.row,
    col: placement.col,
    cells: placement.cells,
  };
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

function collectSearchEntries(counts: Record<string, number>): ItemSearchEntry[] {
  return items
    .map((item) => ({
      itemId: item.id,
      area: item.rotations[0]?.area ?? 0,
      count: normalizeCount(counts[item.id]),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.area - a.area || a.itemId.localeCompare(b.itemId));
}

function remainingAreaTotal(entries: ItemSearchEntry[], remainingCounts: Record<string, number>): number {
  return entries.reduce((total, entry) => total + (remainingCounts[entry.itemId] ?? 0) * entry.area, 0);
}

function createEmptyPlacementsByCell(): CachedPlacement[][] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => []);
}

export function buildPlacementCache(board: Board): PlacementCache {
  const usableMask = buildUsableMask(board);
  const placements: CachedPlacement[] = [];
  const placementsByItemId = new Map<string, CachedPlacement[]>();
  const placementsByCell = createEmptyPlacementsByCell();

  for (const item of items) {
    const itemPlacements: CachedPlacement[] = [];

    item.rotations.forEach((shape, shapeIndex) => {
      for (let row = 0; row <= BOARD_SIZE - shape.height; row += 1) {
        for (let col = 0; col <= BOARD_SIZE - shape.width; col += 1) {
          const mask = placementMask(shape, row, col);

          if ((mask & usableMask) !== mask) {
            continue;
          }

          const placement: CachedPlacement = {
            itemId: item.id,
            rotation: shape.rotation,
            shapeIndex,
            row,
            col,
            area: shape.area,
            cells: absoluteCells(shape, row, col),
            mask,
          };

          placements.push(placement);
          itemPlacements.push(placement);
          placement.cells.forEach((cell) => {
            placementsByCell[cellIndex(cell.row, cell.col)].push(placement);
          });
        }
      }
    });

    placementsByItemId.set(item.id, itemPlacements);
  }

  return { placements, placementsByItemId, placementsByCell };
}

function candidateSignature(candidate: CandidateSolution): string {
  return candidate.placements
    .map(
      (placement) =>
        `${placement.itemId}:${placement.rotation}:${placement.row},${placement.col}:${placement.cells
          .map((cell) => `${cell.row},${cell.col}`)
          .join(';')}`,
    )
    .sort()
    .join('|');
}

function compareScores(a: CandidateScore, b: CandidateScore): number {
  return (
    b.mustUseFilledArea - a.mustUseFilledArea ||
    b.priorityScore - a.priorityScore ||
    b.filledCells - a.filledCells ||
    a.unusedItemCount - b.unusedItemCount ||
    a.signature.localeCompare(b.signature)
  );
}

function isScoreBetterThan(a: CandidateScore, b: CandidateScore | null): boolean {
  return b === null || compareScores(a, b) < 0;
}

function cloneCandidate(candidate: CandidateSolution): CandidateSolution {
  return {
    filledCells: candidate.filledCells,
    placements: candidate.placements.map((placement) => ({
      ...placement,
      cells: placement.cells.map((cell) => ({ ...cell })),
    })),
  };
}

function getUnusedItemCount(selectedCounts: Record<string, number>, usedCounts: Record<string, number>): number {
  return Object.entries(selectedCounts).reduce(
    (total, [itemId, count]) => total + Math.max(0, count - (usedCounts[itemId] ?? 0)),
    0,
  );
}

function makeCandidateScore(
  candidate: CandidateSolution,
  selectedCounts: Record<string, number>,
  usedCounts: Record<string, number>,
  priorityScore: number,
  mustUseFilledArea: number,
): CandidateScore {
  return {
    mustUseFilledArea,
    priorityScore,
    filledCells: candidate.filledCells,
    unusedItemCount: getUnusedItemCount(selectedCounts, usedCounts),
    signature: candidateSignature(candidate),
  };
}

function addCandidate(candidates: ScoredCandidate[], candidate: CandidateSolution, score: CandidateScore, maxSolutions: number) {
  if (candidates.some((existing) => existing.score.signature === score.signature)) {
    return;
  }

  candidates.push({
    solution: cloneCandidate(candidate),
    score,
  });

  candidates.sort((a, b) => compareScores(a.score, b.score));
  candidates.splice(maxSolutions);
}

function getSelectedCounts(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    items
      .map((item) => [item.id, normalizeCount(counts[item.id])] as const)
      .filter(([, count]) => count > 0),
  );
}

function cloneCounts(counts: Record<string, number>): Record<string, number> {
  return { ...counts };
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

function getFirstOpenCellIndex(usableMask: bigint, occupiedMask: bigint): number | null {
  const openMask = usableMask & ~occupiedMask;

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    if ((openMask & bitForIndex(index)) !== 0n) {
      return index;
    }
  }

  return null;
}

function getMustUseSet(mustUseItemIds: string[] | undefined): Set<string> {
  return new Set(mustUseItemIds ?? []);
}

function getPlacementSortKey(
  placement: CachedPlacement,
  remainingCounts: Record<string, number>,
  placementCache: PlacementCache,
  mustUseItems: Set<string>,
  priorityByItemId: Record<string, number> | undefined,
) {
  return {
    mustUse: mustUseItems.has(placement.itemId) ? 1 : 0,
    priority: getItemPriority(placement.itemId, priorityByItemId),
    area: placement.area,
    remainingCount: remainingCounts[placement.itemId] ?? 0,
    restriction: placementCache.placementsByItemId.get(placement.itemId)?.length ?? 0,
  };
}

function comparePlacements(
  a: CachedPlacement,
  b: CachedPlacement,
  remainingCounts: Record<string, number>,
  placementCache: PlacementCache,
  mustUseItems: Set<string>,
  priorityByItemId: Record<string, number> | undefined,
): number {
  const aKey = getPlacementSortKey(a, remainingCounts, placementCache, mustUseItems, priorityByItemId);
  const bKey = getPlacementSortKey(b, remainingCounts, placementCache, mustUseItems, priorityByItemId);

  return (
    bKey.mustUse - aKey.mustUse ||
    bKey.priority - aKey.priority ||
    bKey.area - aKey.area ||
    aKey.remainingCount - bKey.remainingCount ||
    aKey.restriction - bKey.restriction ||
    a.itemId.localeCompare(b.itemId) ||
    a.rotation - b.rotation ||
    a.row - b.row ||
    a.col - b.col
  );
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
  const searchEntries = collectSearchEntries(counts);
  const remainingCounts = cloneCounts(selectedCounts);
  const placementCache = buildPlacementCache(board);
  const candidates: ScoredCandidate[] = [];
  const placements: Placement[] = [];
  const usedCounts: Record<string, number> = {};
  const mustUseItems = getMustUseSet(options.mustUseItemIds);
  const targetFilledCells = Math.min(selectedItemArea, usableCells);

  let bestScore: CandidateScore | null = null;
  let searchedNodes = 0;
  let timedOut = false;
  let shouldStop = false;

  function makeCurrentScore(filledCells: number, priorityScore: number, mustUseFilledArea: number): CandidateScore {
    return makeCandidateScore(
      { filledCells, placements },
      selectedCounts,
      usedCounts,
      priorityScore,
      mustUseFilledArea,
    );
  }

  function remember(filledCells: number, priorityScore: number, mustUseFilledArea: number) {
    const score = makeCurrentScore(filledCells, priorityScore, mustUseFilledArea);

    if (bestScore !== null && compareScores(score, bestScore) > 0) {
      return;
    }

    if (isScoreBetterThan(score, bestScore)) {
      bestScore = score;
      candidates.length = 0;
    }

    addCandidate(candidates, { filledCells, placements }, score, settings.maxSolutions);

    if (candidates.length >= settings.maxSolutions && candidates[0]?.score.filledCells === targetFilledCells) {
      shouldStop = true;
    }
  }

  function canImproveBest(
    occupiedMask: bigint,
    filledCells: number,
    priorityScore: number,
    mustUseFilledArea: number,
  ): boolean {
    if (bestScore === null) {
      return true;
    }

    const freeCells = countBits(usableMask & ~occupiedMask);
    const remainingArea = remainingAreaTotal(searchEntries, remainingCounts);
    const optimisticScore: CandidateScore = {
      mustUseFilledArea:
        mustUseFilledArea +
        Object.entries(remainingCounts).reduce(
          (total, [itemId, count]) => total + (mustUseItems.has(itemId) ? getItemArea(itemId) * count : 0),
          0,
        ),
      priorityScore:
        priorityScore +
        Object.entries(remainingCounts).reduce(
          (total, [itemId, count]) =>
            total + getItemArea(itemId) * getItemPriority(itemId, options.priorityByItemId) * count,
          0,
        ),
      filledCells: filledCells + Math.min(freeCells, remainingArea),
      unusedItemCount: 0,
      signature: '',
    };

    return compareScores(optimisticScore, bestScore) <= 0;
  }

  function dfs(occupiedMask: bigint, filledCells: number, priorityScore: number, mustUseFilledArea: number): void {
    searchedNodes += 1;

    if ((searchedNodes & 255) === 0 && performance.now() - start > settings.timeLimitMs) {
      timedOut = true;
      return;
    }

    remember(filledCells, priorityScore, mustUseFilledArea);

    if (shouldStop || timedOut) {
      return;
    }

    if (!canImproveBest(occupiedMask, filledCells, priorityScore, mustUseFilledArea)) {
      return;
    }

    const pivotCellIndex = getFirstOpenCellIndex(usableMask, occupiedMask);

    if (pivotCellIndex === null) {
      return;
    }

    const pivotPlacements = placementCache.placementsByCell[pivotCellIndex]
      .filter((placement) => (remainingCounts[placement.itemId] ?? 0) > 0 && (placement.mask & occupiedMask) === 0n)
      .sort((a, b) => comparePlacements(a, b, remainingCounts, placementCache, mustUseItems, options.priorityByItemId));

    for (const cachedPlacement of pivotPlacements) {
      const itemPriority = getItemPriority(cachedPlacement.itemId, options.priorityByItemId);
      const mustUseArea = mustUseItems.has(cachedPlacement.itemId) ? cachedPlacement.area : 0;

      remainingCounts[cachedPlacement.itemId] -= 1;
      usedCounts[cachedPlacement.itemId] = (usedCounts[cachedPlacement.itemId] ?? 0) + 1;
      placements.push(toPlacement(cachedPlacement));

      dfs(
        occupiedMask | cachedPlacement.mask,
        filledCells + cachedPlacement.area,
        priorityScore + cachedPlacement.area * itemPriority,
        mustUseFilledArea + mustUseArea,
      );

      placements.pop();
      usedCounts[cachedPlacement.itemId] -= 1;
      if (usedCounts[cachedPlacement.itemId] === 0) {
        delete usedCounts[cachedPlacement.itemId];
      }
      remainingCounts[cachedPlacement.itemId] += 1;

      if (timedOut || shouldStop) {
        return;
      }
    }

    dfs(occupiedMask | bitForIndex(pivotCellIndex), filledCells, priorityScore, mustUseFilledArea);
  }

  dfs(0n, 0, 0, 0);

  const bestSolution = candidates[0]?.solution;
  const finalUsedCounts = getUsedCounts(bestSolution);
  const unusedCounts = getUnusedCounts(selectedCounts, finalUsedCounts);
  const mustUseCounts = getMustUseCounts(selectedCounts, finalUsedCounts, options.mustUseItemIds);
  const placedItemArea = bestSolution?.filledCells ?? 0;

  return {
    bestFilledCells: placedItemArea,
    usableCells,
    utilization: usableCells === 0 ? 0 : placedItemArea / usableCells,
    solutions: candidates.map((candidate) => candidate.solution),
    selectedItemArea,
    placedItemArea,
    selectedPlacementRatio: selectedItemArea === 0 ? 0 : placedItemArea / selectedItemArea,
    usedCounts: finalUsedCounts,
    unusedCounts,
    priorityScore: candidates[0]?.score.priorityScore ?? getPriorityScore(finalUsedCounts, options.priorityByItemId),
    mustUseSatisfied: Object.keys(mustUseCounts.unused).length === 0,
    mustUseUsedCounts: mustUseCounts.used,
    mustUseUnusedCounts: mustUseCounts.unused,
    targetFilledCells,
    provenOptimal: !timedOut,
    stopReason: timedOut ? 'time-limit' : 'complete',
    searchedNodes,
  };
}
