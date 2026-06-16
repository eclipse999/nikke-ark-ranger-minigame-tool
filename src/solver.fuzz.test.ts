import { describe, expect, it } from 'vitest';
import { createDefaultBoard, createFullBoard, countUsableCells } from './board';
import { solveInventory } from './solver';
import { getSelectedItemArea } from './solverDiagnostics';
import { assertSolverResultIsLegal } from './solverTestUtils';
import type { Board, SolverResult } from './types';

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

const ALL_ITEM_IDS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12', 'P13', 'P14'];

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

describe('solver fuzz', () => {
  const SEED = 0x5eed;
  const FUZZ_CASES = 500;

  it(`runs ${FUZZ_CASES} deterministic fuzz cases per board`, () => {
    const rng = createRng(SEED);

    for (let caseIndex = 0; caseIndex < FUZZ_CASES; caseIndex += 1) {
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

      const optionSets: Array<{ label: string; options: Record<string, unknown> }> = [
        { label: 'no must-use', options: { maxSolutions: 4, timeLimitMs: 200 } },
      ];

      if (mustUseItemIds.length > 0) {
        optionSets.push({
          label: 'with must-use',
          options: { maxSolutions: 4, timeLimitMs: 200, mustUseItemIds },
        });
      }

      for (const board of testBoards) {
        const usableCells = countUsableCells(board);
        if (usableCells === 0) continue;

        for (const { options } of optionSets) {
          const result = solveInventory(board, counts, options);
          assertSolverResultIsLegal(board, counts, result, options as never);

          if (result.provenOptimal) {
            expect(result.stopReason).toBe('complete');
          }
        }
      }
    }
  }, 120_000);

  it('maintains deterministic behavior across 100 repeated runs', () => {
    const rng = createRng(SEED);
    const determinismCases = 100;

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
