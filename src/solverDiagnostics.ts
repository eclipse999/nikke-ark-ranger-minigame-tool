import { itemById } from './items';
import type { CandidateSolution, SolverResult } from './types';

export type SolverDiagnostics = {
  usableCells: number;
  selectedItemArea: number;
  filledCells: number;
  placedItemArea: number;
  selectedPlacementRatio: number;
  usedCounts: Record<string, number>;
  unusedCounts: Record<string, number>;
  priorityScore: number;
  mustUseSatisfied: boolean;
  mustUseUsedCounts: Record<string, number>;
  mustUseUnusedCounts: Record<string, number>;
  targetFilledCells: number;
  searchedNodes: number;
  stopReason: SolverResult['stopReason'];
};

function normalizeCount(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
}

export function getSelectedItemArea(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((total, [itemId, rawCount]) => {
    const item = itemById.get(itemId);
    const count = normalizeCount(rawCount);
    return total + count * (item?.rotations[0]?.area ?? 0);
  }, 0);
}

export function getUsedCounts(solution: CandidateSolution | undefined): Record<string, number> {
  const usedCounts: Record<string, number> = {};

  solution?.placements.forEach((placement) => {
    usedCounts[placement.itemId] = (usedCounts[placement.itemId] ?? 0) + 1;
  });

  return usedCounts;
}

export function getUnusedCounts(
  counts: Record<string, number>,
  usedCounts: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts)
      .map(([itemId, rawCount]) => [itemId, Math.max(0, normalizeCount(rawCount) - (usedCounts[itemId] ?? 0))] as const)
      .filter(([, count]) => count > 0),
  );
}

export function summarizeSolverResult(
  counts: Record<string, number>,
  result: SolverResult,
  solution: CandidateSolution | undefined = result.solutions[0],
): SolverDiagnostics {
  const selectedItemArea = result.selectedItemArea ?? getSelectedItemArea(counts);
  const usedCounts = Object.keys(result.usedCounts).length > 0 ? result.usedCounts : getUsedCounts(solution);

  return {
    usableCells: result.usableCells,
    selectedItemArea,
    filledCells: result.bestFilledCells,
    placedItemArea: result.placedItemArea,
    selectedPlacementRatio: result.selectedPlacementRatio,
    usedCounts,
    unusedCounts: Object.keys(result.unusedCounts).length > 0 ? result.unusedCounts : getUnusedCounts(counts, usedCounts),
    priorityScore: result.priorityScore,
    mustUseSatisfied: result.mustUseSatisfied,
    mustUseUsedCounts: result.mustUseUsedCounts,
    mustUseUnusedCounts: result.mustUseUnusedCounts,
    targetFilledCells: result.targetFilledCells,
    searchedNodes: result.searchedNodes,
    stopReason: result.stopReason,
  };
}
