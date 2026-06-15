import { describe, it } from 'vitest';
import { createDefaultBoard, createFullBoard } from './board';
import { solveInventory } from './solver';
import type { Board, SolverOptions, SolverResult } from './types';

type BenchmarkCase = {
  name: string;
  board: Board;
  counts: Record<string, number>;
  options: SolverOptions;
};

type BenchmarkMetrics = Pick<
  SolverResult,
  | 'bestFilledCells'
  | 'utilization'
  | 'selectedPlacementRatio'
  | 'priorityScore'
  | 'mustUseSatisfied'
  | 'provenOptimal'
  | 'stopReason'
  | 'searchedNodes'
> & {
  solutionsLength: number;
  firstSolutionSignature: string;
};

const repeatCount = 5;

function boardFromRows(rows: string[]): Board {
  return rows.map((row) => [...row].map((cell) => cell === '.'));
}

function firstSolutionSignature(result: SolverResult): string {
  return (
    result.solutions[0]?.placements
      .flatMap((placement) =>
        placement.cells.map((cell) => `${cell.row},${cell.col}:${placement.itemId}:${placement.rotation}`),
      )
      .sort()
      .join('|') ?? ''
  );
}

function toMetrics(result: SolverResult): BenchmarkMetrics {
  return {
    bestFilledCells: result.bestFilledCells,
    utilization: Number(result.utilization.toFixed(4)),
    selectedPlacementRatio: Number(result.selectedPlacementRatio.toFixed(4)),
    priorityScore: result.priorityScore,
    mustUseSatisfied: result.mustUseSatisfied,
    provenOptimal: result.provenOptimal,
    stopReason: result.stopReason,
    searchedNodes: result.searchedNodes,
    solutionsLength: result.solutions.length,
    firstSolutionSignature: firstSolutionSignature(result),
  };
}

function summarizeMetrics(metrics: BenchmarkMetrics) {
  return {
    bestFilledCells: metrics.bestFilledCells,
    utilization: metrics.utilization,
    selectedPlacementRatio: metrics.selectedPlacementRatio,
    priorityScore: metrics.priorityScore,
    mustUseSatisfied: metrics.mustUseSatisfied,
    provenOptimal: metrics.provenOptimal,
    stopReason: metrics.stopReason,
    searchedNodes: metrics.searchedNodes,
    solutionsLength: metrics.solutionsLength,
  };
}

function isSameMetrics(a: BenchmarkMetrics, b: BenchmarkMetrics): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const cases: BenchmarkCase[] = [
  {
    name: 'simple',
    board: createFullBoard(),
    counts: { P07: 1, P10: 2, P11: 4 },
    options: { maxSolutions: 4, timeLimitMs: 500 },
  },
  {
    name: 'dense items',
    board: createDefaultBoard(),
    counts: { P01: 3, P03: 3, P05: 3, P08: 4, P12: 2, P14: 4 },
    options: { maxSolutions: 4, timeLimitMs: 1000 },
  },
  {
    name: 'fragmented backpack',
    board: boardFromRows([
      '.x.x.x.x.',
      '.........',
      'x..x.x..x',
      '.........',
      '.x.xxx.x.',
      '.........',
      'x..x.x..x',
      '.........',
      '.x.x.x.x.',
    ]),
    counts: { P06: 3, P08: 3, P10: 4, P11: 8, P13: 2 },
    options: { maxSolutions: 4, timeLimitMs: 1000 },
  },
  {
    name: 'must-use pressure',
    board: createDefaultBoard(),
    counts: { P11: 10, P12: 1, P14: 8 },
    options: { maxSolutions: 4, timeLimitMs: 1000, mustUseItemIds: ['P12'] },
  },
  {
    name: 'priority pressure',
    board: createDefaultBoard(),
    counts: { P07: 4, P11: 12, P12: 2, P14: 8 },
    options: {
      maxSolutions: 4,
      timeLimitMs: 3000,
      priorityByItemId: { P11: 4, P12: 5, P14: 1 },
    },
  },
];

describe('solver benchmark', () => {
  it('prints deterministic regression metrics for fixed solver cases', () => {
    console.log(`\nsolver benchmark (${repeatCount} runs per case)`);

    cases.forEach((benchmarkCase) => {
      const runs = Array.from({ length: repeatCount }, () =>
        toMetrics(solveInventory(benchmarkCase.board, benchmarkCase.counts, benchmarkCase.options)),
      );
      const firstRun = runs[0];
      const deterministic = runs.every((run) => isSameMetrics(run, firstRun));

      console.log(`\n${benchmarkCase.name}${deterministic ? '' : ' [warning: non-deterministic result]'}`);
      console.table(runs.map((run, index) => ({ run: index + 1, ...summarizeMetrics(run) })));
    });
  }, 30_000);
});
