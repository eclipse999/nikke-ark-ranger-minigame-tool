import { describe, expect, it } from 'vitest';
import { createDefaultBoard, createFullBoard, countUsableCells } from './board';
import { items } from './items';
import { solveInventory } from './solver';
import { getSelectedItemArea } from './solverDiagnostics';
import { assertSolverResultIsLegal } from './solverTestUtils';
import type { Board, SolverOptions, SolverResult } from './types';

function createRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boardFromRows(rows: string[]): Board {
  return rows.map((row) => [...row].map((cell) => cell === '.'));
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const ALL_ITEM_IDS = items.map((item) => item.id);

function solutionSignature(result: SolverResult): string {
  return (
    result.solutions[0]?.placements
      .flatMap((placement) =>
        placement.cells.map((cell) => `${cell.row},${cell.col}:${placement.itemId}:${placement.rotation}`),
      )
      .sort()
      .join('|') ?? ''
  );
}

const irregularBoards: Board[] = [
  boardFromRows([
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
  boardFromRows([
    '.........',
    '..x...x..',
    '.xx...xx.',
    '....x....',
    '.........',
    '....x....',
    '.xx...xx.',
    '..x...x..',
    '.........',
  ]),
  boardFromRows([
    '.xxxxxxxx',
    '.xxxxxxxx',
    'xxxxxxxxx',
    'xxxxxxxxx',
    'xxxxxxxxx',
    'xxxxxxxxx',
    'xxxxxxxxx',
    'xxxxxxxxx',
    'xxxxxxxxx',
  ]),
];

const testBoards = [createFullBoard(), createDefaultBoard(), ...irregularBoards];

type FuzzCase = {
  counts: Record<string, number>;
  optionSets: Array<{ options: SolverOptions }>;
};

function generateFuzzCases(seed: number, caseCount: number): FuzzCase[] {
  const rng = createRng(seed);
  const cases: FuzzCase[] = [];

  for (let caseIndex = 0; caseIndex < caseCount; caseIndex += 1) {
    const counts: Record<string, number> = {};
    for (const id of ALL_ITEM_IDS) {
      const c = Math.floor(rng() * 6);
      if (c > 0) {
        counts[id] = c;
      }
    }
    if (Object.keys(counts).length === 0) {
      counts[ALL_ITEM_IDS[Math.floor(rng() * ALL_ITEM_IDS.length)]] = 1;
    }

    const availableForMustUse = Object.keys(counts);
    const mustUseCount = Math.min(Math.floor(rng() * 3), availableForMustUse.length);
    const mustUseItemIds = shuffle(availableForMustUse, rng).slice(0, mustUseCount);

    const optionSets: Array<{ options: SolverOptions }> = [
      { options: { maxSolutions: 4, timeLimitMs: 200 } },
    ];

    if (mustUseItemIds.length > 0) {
      optionSets.push({
        options: { maxSolutions: 4, timeLimitMs: 200, mustUseItemIds },
      });
    }

    cases.push({ counts, optionSets });
  }

  return cases;
}

function assertFuzzCase(caseInput: FuzzCase): void {
  for (const board of testBoards) {
    const usableCells = countUsableCells(board);
    if (usableCells === 0) continue;

    for (const { options } of caseInput.optionSets) {
      const result = solveInventory(board, caseInput.counts, options);
      assertSolverResultIsLegal(board, caseInput.counts, result, options);

      if (result.provenOptimal) {
        expect(result.stopReason).toBe('complete');
      }
    }
  }
}

describe('solver fuzz', () => {
  const SEED = 0x5eed;
  const FUZZ_CASES = 40;
  const FUZZ_BATCH_SIZE = 20;
  const fuzzCases = generateFuzzCases(SEED, FUZZ_CASES);

  for (let batchStart = 0; batchStart < FUZZ_CASES; batchStart += FUZZ_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + FUZZ_BATCH_SIZE, FUZZ_CASES);

    it(`runs deterministic fuzz cases ${batchStart + 1}-${batchEnd} per board`, () => {
      for (const caseInput of fuzzCases.slice(batchStart, batchEnd)) {
        assertFuzzCase(caseInput);
      }
    }, 90_000);
  }

  it('maintains deterministic behavior across repeated runs', () => {
    const rng = createRng(SEED);
    const determinismCases = 20;

    for (let i = 0; i < determinismCases; i += 1) {
      const counts: Record<string, number> = {};
      for (const id of ALL_ITEM_IDS) {
        const c = Math.floor(rng() * 2);
        if (c > 0) {
          counts[id] = c;
        }
      }
      if (Object.keys(counts).length === 0) {
        counts.P11 = 1;
      }

      const board = testBoards[i % testBoards.length];
      if (countUsableCells(board) === 0) continue;

      const options = { maxSolutions: 3, timeLimitMs: 1000 };

      const first = solveInventory(board, counts, options);
      const second = solveInventory(board, counts, options);

      if (!first.provenOptimal || !second.provenOptimal) continue;

      expect(first.bestFilledCells).toBe(second.bestFilledCells);
      expect(first.usedCounts).toEqual(second.usedCounts);
      expect(first.unusedCounts).toEqual(second.unusedCounts);
      expect(solutionSignature(first)).toBe(solutionSignature(second));
    }
  }, 120_000);
});
