import { countUsableCells, BOARD_SIZE } from './board';
import { items } from './items';
import type { Board, CandidateSolution, Cell, Placement, Shape, SolverResult } from './types';

type PieceInstance = {
  itemId: string;
  shapes: Shape[];
  area: number;
};

type SolverOptions = {
  maxSolutions?: number;
  timeLimitMs?: number;
};

const defaultOptions: Required<SolverOptions> = {
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

function collectPieceInstances(counts: Record<string, number>): PieceInstance[] {
  const itemTypes = items
    .map((item) => ({
      itemId: item.id,
      shapes: item.rotations,
      area: item.rotations[0]?.area ?? 0,
      count: Math.max(0, Math.floor(counts[item.id] ?? 0)),
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

export function solveInventory(
  board: Board,
  counts: Record<string, number>,
  options: SolverOptions = {},
): SolverResult {
  const settings = { ...defaultOptions, ...options };
  const start = performance.now();
  const usableMask = buildUsableMask(board);
  const usableCells = countUsableCells(board);
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

  return {
    bestFilledCells,
    usableCells,
    utilization: usableCells === 0 ? 0 : bestFilledCells / usableCells,
    solutions: candidates,
    provenOptimal: !timedOut,
    stopReason: timedOut ? 'time-limit' : 'complete',
    searchedNodes,
  };
}
