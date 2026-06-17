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
  filledCells: number;
  unusedItemCount: number;
  retainedPlacementCount: number;
  signature: string;
};

type ObjectiveScore = Pick<CandidateScore, 'mustUseFilledArea' | 'filledCells' | 'unusedItemCount'>;

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

function placementSignature(placement: Placement): string {
  return `${placement.itemId}:${placement.rotation}:${placement.row},${placement.col}:${placement.cells
    .map((cell) => `${cell.row},${cell.col}`)
    .join(';')}`;
}

function normalizeCount(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
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

export function compareObjectiveScores(a: ObjectiveScore, b: ObjectiveScore): number {
  return (
    b.mustUseFilledArea - a.mustUseFilledArea ||
    b.filledCells - a.filledCells ||
    a.unusedItemCount - b.unusedItemCount
  );
}

export function compareCandidateScoresForDisplay(a: CandidateScore, b: CandidateScore): number {
  return (
    compareObjectiveScores(a, b) ||
    b.retainedPlacementCount - a.retainedPlacementCount ||
    a.signature.localeCompare(b.signature)
  );
}

function isScoreBetterThan(a: ObjectiveScore, b: ObjectiveScore | null): boolean {
  return b === null || compareObjectiveScores(a, b) < 0;
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

function getBaselinePlacementSignatures(placements: Placement[] | undefined): Set<string> {
  return new Set((placements ?? []).map((placement) => placementSignature(placement)));
}

function getRetainedPlacementCount(candidate: CandidateSolution, baselinePlacementSignatures: Set<string>): number {
  if (baselinePlacementSignatures.size === 0) {
    return 0;
  }

  return candidate.placements.reduce(
    (count, placement) => count + (baselinePlacementSignatures.has(placementSignature(placement)) ? 1 : 0),
    0,
  );
}

function makeCandidateScore(
  candidate: CandidateSolution,
  objectiveScore: ObjectiveScore,
  baselinePlacementSignatures: Set<string>,
): CandidateScore {
  return {
    ...objectiveScore,
    retainedPlacementCount: getRetainedPlacementCount(candidate, baselinePlacementSignatures),
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

  candidates.sort((a, b) => compareCandidateScoresForDisplay(a.score, b.score));
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

function getCountsArea(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((total, [itemId, count]) => total + getItemArea(itemId) * count, 0);
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

function getBestPivotCellIndex(
  usableMask: bigint,
  occupiedMask: bigint,
  remainingCounts: Record<string, number>,
  placementCache: PlacementCache,
): number | null {
  const openMask = usableMask & ~occupiedMask;
  let bestIndex: number | null = null;
  let bestPlacementCount = Number.POSITIVE_INFINITY;

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    if ((openMask & bitForIndex(index)) === 0n) {
      continue;
    }

    const placementCount = placementCache.placementsByCell[index].filter(
      (placement) => (remainingCounts[placement.itemId] ?? 0) > 0 && (placement.mask & occupiedMask) === 0n,
    ).length;

    if (placementCount < bestPlacementCount) {
      bestIndex = index;
      bestPlacementCount = placementCount;

      if (placementCount === 0) {
        return index;
      }
    }
  }

  return bestIndex;
}

function getMustUseSet(mustUseItemIds: string[] | undefined): Set<string> {
  return new Set(mustUseItemIds ?? []);
}

function getPlacementSortKey(
  placement: CachedPlacement,
  remainingCounts: Record<string, number>,
  placementCache: PlacementCache,
  mustUseItems: Set<string>,
) {
  return {
    mustUse: mustUseItems.has(placement.itemId) ? 1 : 0,
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
  preferInventoryPressure: boolean,
): number {
  const aKey = getPlacementSortKey(a, remainingCounts, placementCache, mustUseItems);
  const bKey = getPlacementSortKey(b, remainingCounts, placementCache, mustUseItems);

  const inventoryPressureComparison = bKey.remainingCount - aKey.remainingCount || bKey.area - aKey.area;
  const areaComparison = bKey.area - aKey.area || aKey.remainingCount - bKey.remainingCount;

  const primaryComparison = preferInventoryPressure
    ? inventoryPressureComparison
    : areaComparison;

  return (
    primaryComparison ||
    bKey.mustUse - aKey.mustUse ||
    aKey.restriction - bKey.restriction ||
    a.itemId.localeCompare(b.itemId) ||
    a.rotation - b.rotation ||
    a.row - b.row ||
    a.col - b.col
  );
}

function comparePlacementsWithBaseline(
  a: CachedPlacement,
  b: CachedPlacement,
  remainingCounts: Record<string, number>,
  placementCache: PlacementCache,
  mustUseItems: Set<string>,
  baselinePlacementSignatures: Set<string>,
  preferInventoryPressure: boolean,
): number {
  const aKey = getPlacementSortKey(a, remainingCounts, placementCache, mustUseItems);
  const bKey = getPlacementSortKey(b, remainingCounts, placementCache, mustUseItems);

  const inventoryPressureComparison = bKey.remainingCount - aKey.remainingCount || bKey.area - aKey.area;
  const areaComparison = bKey.area - aKey.area || aKey.remainingCount - bKey.remainingCount;
  const retainedComparison =
    Number(baselinePlacementSignatures.has(placementSignature(b))) -
    Number(baselinePlacementSignatures.has(placementSignature(a)));

  const primaryComparison = preferInventoryPressure
    ? inventoryPressureComparison
    : areaComparison;

  return (
    primaryComparison ||
    bKey.mustUse - aKey.mustUse ||
    retainedComparison ||
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
  const baselinePlacementSignatures = getBaselinePlacementSignatures(options.movementBaselinePlacements);
  const hasMovementBaseline = baselinePlacementSignatures.size > 0;
  const totalMustUseArea = Object.entries(selectedCounts)
    .filter(([itemId]) => mustUseItems.has(itemId))
    .reduce((sum, [itemId, count]) => sum + getItemArea(itemId) * count, 0);
  const targetFilledCells = Math.min(selectedItemArea, usableCells);
  const tryNoSkipPass = settings.timeLimitMs > 0 && selectedItemArea > 0;

  let bestScore: ObjectiveScore | null = null;
  let searchedNodes = 0;
  let timedOut = false;
  let passTimedOut = false;
  let shouldStop = false;
  let activeTimeLimitMs = settings.timeLimitMs;

  function makeCurrentObjectiveScore(filledCells: number, mustUseFilledArea: number): ObjectiveScore {
    return {
      mustUseFilledArea,
      filledCells,
      unusedItemCount: getUnusedItemCount(selectedCounts, usedCounts),
    };
  }

  function makeCurrentCandidateScore(filledCells: number, objectiveScore: ObjectiveScore): CandidateScore {
    return makeCandidateScore(
      { filledCells, placements },
      objectiveScore,
      baselinePlacementSignatures,
    );
  }

  function remember(filledCells: number, mustUseFilledArea: number) {
    const objectiveScore = makeCurrentObjectiveScore(filledCells, mustUseFilledArea);

    if (bestScore !== null && compareObjectiveScores(objectiveScore, bestScore) > 0) {
      return;
    }

    if (isScoreBetterThan(objectiveScore, bestScore)) {
      bestScore = objectiveScore;
      candidates.length = 0;
    }

    const score = makeCurrentCandidateScore(filledCells, objectiveScore);

    addCandidate(candidates, { filledCells, placements }, score, settings.maxSolutions);

    if (
      !hasMovementBaseline &&
      candidates.length >= settings.maxSolutions &&
      candidates[0]?.score.filledCells === targetFilledCells &&
      candidates[0]?.score.mustUseFilledArea >= totalMustUseArea
    ) {
      shouldStop = true;
    }
  }

  function canImproveBest(
    occupiedMask: bigint,
    filledCells: number,
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
      filledCells: filledCells + Math.min(freeCells, remainingArea),
      unusedItemCount: 0,
      retainedPlacementCount: 0,
      signature: '',
    };

    return compareObjectiveScores(optimisticScore, bestScore) <= 0;
  }

  function dfs(
    occupiedMask: bigint,
    filledCells: number,
    mustUseFilledArea: number,
    allowSkip: boolean,
    preferInventoryPressure: boolean,
  ): void {
    searchedNodes += 1;

    remember(filledCells, mustUseFilledArea);

    if (activeTimeLimitMs <= 0 || ((searchedNodes & 255) === 0 && performance.now() - start > activeTimeLimitMs)) {
      if (activeTimeLimitMs < settings.timeLimitMs) {
        passTimedOut = true;
      } else {
        timedOut = true;
      }
      return;
    }

    if (shouldStop || timedOut || passTimedOut) {
      return;
    }

    if (!canImproveBest(occupiedMask, filledCells, mustUseFilledArea)) {
      return;
    }

    const pivotCellIndex = getBestPivotCellIndex(usableMask, occupiedMask, remainingCounts, placementCache);

    if (pivotCellIndex === null) {
      return;
    }

    const pivotPlacements = placementCache.placementsByCell[pivotCellIndex]
      .filter((placement) => (remainingCounts[placement.itemId] ?? 0) > 0 && (placement.mask & occupiedMask) === 0n)
      .sort((a, b) =>
        hasMovementBaseline
          ? comparePlacementsWithBaseline(
              a,
              b,
              remainingCounts,
              placementCache,
              mustUseItems,
              baselinePlacementSignatures,
              preferInventoryPressure,
            )
          : comparePlacements(
              a,
              b,
              remainingCounts,
              placementCache,
              mustUseItems,
              preferInventoryPressure,
            ),
      );

    for (const cachedPlacement of pivotPlacements) {
      const mustUseArea = mustUseItems.has(cachedPlacement.itemId) ? cachedPlacement.area : 0;

      remainingCounts[cachedPlacement.itemId] -= 1;
      usedCounts[cachedPlacement.itemId] = (usedCounts[cachedPlacement.itemId] ?? 0) + 1;
      placements.push(toPlacement(cachedPlacement));

      dfs(
        occupiedMask | cachedPlacement.mask,
        filledCells + cachedPlacement.area,
        mustUseFilledArea + mustUseArea,
        allowSkip,
        preferInventoryPressure,
      );

      placements.pop();
      usedCounts[cachedPlacement.itemId] -= 1;
      if (usedCounts[cachedPlacement.itemId] === 0) {
        delete usedCounts[cachedPlacement.itemId];
      }
      remainingCounts[cachedPlacement.itemId] += 1;

      if (timedOut || passTimedOut || shouldStop) {
        return;
      }
    }

    if (allowSkip) {
      dfs(
        occupiedMask | bitForIndex(pivotCellIndex),
        filledCells,
        mustUseFilledArea,
        allowSkip,
        preferInventoryPressure,
      );
    }
  }

  if (tryNoSkipPass) {
    activeTimeLimitMs = Math.min(settings.timeLimitMs, 250);
    dfs(0n, 0, 0, false, true);
  }

  if (!shouldStop && !timedOut) {
    passTimedOut = false;
    activeTimeLimitMs = settings.timeLimitMs;
    dfs(0n, 0, 0, true, false);
  }

  const bestSolution = candidates[0]?.solution;
  const retainedPlacementCount = candidates[0]?.score.retainedPlacementCount ?? 0;
  const finalUsedCounts = getUsedCounts(bestSolution);
  const unusedCounts = getUnusedCounts(selectedCounts, finalUsedCounts);
  const mustUseCounts = getMustUseCounts(selectedCounts, finalUsedCounts, options.mustUseItemIds);
  const placedItemArea = bestSolution?.filledCells ?? 0;
  const movementCost = hasMovementBaseline && bestSolution
    ? Math.max(0, bestSolution.placements.length - retainedPlacementCount)
    : 0;

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
    mustUseSatisfied: Object.keys(mustUseCounts.unused).length === 0,
    mustUseUsedCounts: mustUseCounts.used,
    mustUseUnusedCounts: mustUseCounts.unused,
    targetFilledCells,
    provenOptimal: !timedOut,
    stopReason: timedOut ? 'time-limit' : 'complete',
    searchedNodes,
    retainedPlacementCount,
    movementCost,
  };
}
