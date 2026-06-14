import { describe, expect, it } from 'vitest';
import { createDefaultBoard, createFullBoard } from './board';
import { buildPlacementCache, solveInventory } from './solver';
import { getSelectedItemArea, summarizeSolverResult } from './solverDiagnostics';
import type { Board } from './types';

function boardFromRows(rows: string[]): Board {
  return rows.map((row) => [...row].map((cell) => cell === '.'));
}

function placementItemIds(result: ReturnType<typeof solveInventory>): string[] {
  return result.solutions[0]?.placements.map((placement) => placement.itemId).sort() ?? [];
}

function solutionSignature(result: ReturnType<typeof solveInventory>): string {
  return (
    result.solutions[0]?.placements
      .flatMap((placement) =>
        placement.cells.map((cell) => `${cell.row},${cell.col}:${placement.itemId}:${placement.rotation}`),
      )
      .sort()
      .join('|') ?? ''
  );
}

function testCellIndex(row: number, col: number): number {
  return row * 9 + col;
}

describe('solver', () => {
  it('returns zero when no items are provided', () => {
    const result = solveInventory(createDefaultBoard(), {}, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(0);
    expect(result.provenOptimal).toBe(true);
    expect(result.solutions[0]).toMatchObject({ filledCells: 0, placements: [] });
  });

  it('places a single-cell item on the default board', () => {
    const result = solveInventory(createDefaultBoard(), { P11: 1 }, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(1);
    expect(result.solutions[0].placements).toHaveLength(1);
  });

  it('keeps existing behavior when options are omitted', () => {
    const counts = { P11: 2 };
    const withoutOptions = solveInventory(createDefaultBoard(), counts);
    const withEmptyOptions = solveInventory(createDefaultBoard(), counts, {});

    expect(withoutOptions.bestFilledCells).toBe(2);
    expect(withoutOptions.bestFilledCells).toBe(withEmptyOptions.bestFilledCells);
    expect(solutionSignature(withoutOptions)).toBe(solutionSignature(withEmptyOptions));
  });

  it('defaults priority to 1 and must-use to empty', () => {
    const counts = { P07: 1, P11: 2 };
    const result = solveInventory(createFullBoard(), counts, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.priorityScore).toBe(result.placedItemArea);
    expect(result.mustUseSatisfied).toBe(true);
    expect(result.mustUseUsedCounts).toEqual({});
    expect(result.mustUseUnusedCounts).toEqual({});
  });

  it('normalizes priority values before calculating priorityScore', () => {
    const counts = { P07: 1, P08: 1, P11: 1 };
    const result = solveInventory(createFullBoard(), counts, {
      maxSolutions: 3,
      timeLimitMs: 100,
      priorityByItemId: { P07: 0, P08: 7.8, P11: Number.NaN },
    });

    expect(result.priorityScore).toBe(20);
  });

  it('does not return duplicate visual solutions for identical item copies', () => {
    const board: Board = [
      [true, true, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
    ];

    const result = solveInventory(board, { P11: 2 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(2);
    expect(result.solutions).toHaveLength(1);
  });

  it('does not create duplicate visual solutions for several identical item counts', () => {
    const board = boardFromRows([
      '...xxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);

    const result = solveInventory(board, { P11: 3 }, { maxSolutions: 8, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(3);
    expect(result.solutions).toHaveLength(1);
    expect(result.usedCounts).toEqual({ P11: 3 });
    expect(result.unusedCounts).toEqual({});
  });

  it('fills a full board with single-cell items', () => {
    const result = solveInventory(createFullBoard(), { P11: 81 }, { timeLimitMs: 500 });
    expect(result.bestFilledCells).toBe(81);
  });

  it('fills all selected item area when total selected area fits and a complete solution exists', () => {
    const counts = { P07: 2, P08: 1, P10: 1 };
    const result = solveInventory(createFullBoard(), counts, { maxSolutions: 3, timeLimitMs: 500 });

    expect(getSelectedItemArea(counts)).toBeLessThanOrEqual(result.usableCells);
    expect(result.bestFilledCells).toBe(getSelectedItemArea(counts));
    expect(result.selectedItemArea).toBe(getSelectedItemArea(counts));
    expect(result.targetFilledCells).toBe(result.selectedItemArea);
    expect(result.selectedPlacementRatio).toBe(1);
    expect(result.solutions[0].placements).toHaveLength(4);
  });

  it('never fills more cells than are usable when selected item area exceeds board capacity', () => {
    const counts = { P14: 20 };
    const result = solveInventory(createDefaultBoard(), counts, { maxSolutions: 3, timeLimitMs: 500 });

    expect(getSelectedItemArea(counts)).toBeGreaterThan(result.usableCells);
    expect(result.bestFilledCells).toBeLessThanOrEqual(result.usableCells);
    expect(result.utilization).toBeLessThanOrEqual(1);
    expect(result.selectedItemArea).toBe(getSelectedItemArea(counts));
    expect(result.targetFilledCells).toBe(result.usableCells);
  });

  it('maximizes filled cells when selected item area exceeds usable cells and priorities are equal', () => {
    const board = boardFromRows([
      '..xxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P10: 1, P11: 3 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.selectedItemArea).toBeGreaterThan(result.usableCells);
    expect(result.bestFilledCells).toBe(2);
    expect(result.usedCounts).toEqual({ P11: 2 });
  });

  it('prefers a high-priority item over a mutually exclusive low-priority item', () => {
    const board = boardFromRows([
      '.xxxxxxxx',
      '.xxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P10: 1, P11: 1 }, {
      maxSolutions: 3,
      timeLimitMs: 100,
      priorityByItemId: { P10: 1, P11: 5 },
    });

    expect(result.usedCounts).toEqual({ P11: 1 });
    expect(result.priorityScore).toBe(5);
  });

  it('prefers a must-use item over a mutually exclusive normal item', () => {
    const board = boardFromRows([
      '.xxxxxxxx',
      '.xxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P10: 1, P11: 1 }, {
      maxSolutions: 3,
      timeLimitMs: 100,
      mustUseItemIds: ['P11'],
    });

    expect(result.usedCounts).toEqual({ P11: 1 });
    expect(result.mustUseSatisfied).toBe(true);
    expect(result.mustUseUsedCounts).toEqual({ P11: 1 });
  });

  it('reports used and unused counts from the best solution', () => {
    const board = boardFromRows([
      '..xxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P11: 3 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(2);
    expect(result.usedCounts).toEqual({ P11: 2 });
    expect(result.unusedCounts).toEqual({ P11: 1 });
    expect(result.placedItemArea).toBe(2);
    expect(result.selectedItemArea).toBe(3);
    expect(result.selectedPlacementRatio).toBe(2 / 3);
  });

  it('reports used and unused counts for repeated larger items', () => {
    const board = boardFromRows([
      '..xxxxxxx',
      '..xxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P07: 2 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(4);
    expect(result.usedCounts).toEqual({ P07: 1 });
    expect(result.unusedCounts).toEqual({ P07: 1 });
  });

  it('reports unsatisfied must-use items without discarding the best available solution', () => {
    const board = boardFromRows([
      '.xxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P10: 1, P11: 1 }, { mustUseItemIds: ['P10'], timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(1);
    expect(result.usedCounts).toEqual({ P11: 1 });
    expect(result.mustUseSatisfied).toBe(false);
    expect(result.mustUseUsedCounts).toEqual({});
    expect(result.mustUseUnusedCounts).toEqual({ P10: 1 });
  });

  it('keeps a non-empty best solution when must-use items cannot all be placed', () => {
    const board = boardFromRows([
      '.xxxxxxxx',
      '.xxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P09: 1, P11: 1 }, { mustUseItemIds: ['P09'], timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(1);
    expect(result.solutions[0].placements).toHaveLength(1);
    expect(result.usedCounts).toEqual({ P11: 1 });
    expect(result.mustUseSatisfied).toBe(false);
    expect(result.mustUseUnusedCounts).toEqual({ P09: 1 });
  });

  it('handles items that cannot fit', () => {
    const result = solveInventory(createDefaultBoard(), { P14: 1 }, { timeLimitMs: 100 });
    expect(result.bestFilledCells).toBe(6);
  });

  it('handles an irregular board without placing outside usable cells', () => {
    const board = boardFromRows([
      '.........',
      '..x...x..',
      '.xx...xx.',
      '....x....',
      '.........',
      '....x....',
      '.xx...xx.',
      '..x...x..',
      '.........',
    ]);
    const result = solveInventory(board, { P06: 2, P08: 2, P11: 4 }, { maxSolutions: 4, timeLimitMs: 500 });
    const availableCells = new Set(
      board.flatMap((rowCells, row) =>
        rowCells.flatMap((available, col) => (available ? [`${row},${col}`] : [])),
      ),
    );

    expect(result.bestFilledCells).toBeGreaterThan(0);
    result.solutions[0].placements.forEach((placement) => {
      placement.cells.forEach((cell) => {
        expect(availableCells.has(`${cell.row},${cell.col}`)).toBe(true);
      });
    });
  });

  it('builds a placement cache without placements that cover blocked cells', () => {
    const board = boardFromRows([
      '.xxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const cache = buildPlacementCache(board);

    expect(cache.placementsByItemId.get('P11')).toHaveLength(1);
    expect(cache.placementsByItemId.get('P10')).toHaveLength(0);
    expect(cache.placements.every((placement) => placement.cells.every((cell) => board[cell.row][cell.col]))).toBe(true);
  });

  it('indexes cached placements by every board cell they cover', () => {
    const board = boardFromRows([
      '..xxxxxxx',
      '..xxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const cache = buildPlacementCache(board);
    const topLeftPlacements = cache.placementsByCell[testCellIndex(0, 0)];
    const bottomRightPlacements = cache.placementsByCell[testCellIndex(1, 1)];

    expect(topLeftPlacements.some((placement) => placement.itemId === 'P07')).toBe(true);
    expect(bottomRightPlacements.some((placement) => placement.itemId === 'P07')).toBe(true);
    expect(cache.placementsByCell[testCellIndex(8, 8)]).toEqual([]);
  });

  it('uses de-duplicated item rotations when building the placement cache', () => {
    const board = boardFromRows([
      '..xxxxxxx',
      '..xxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const cache = buildPlacementCache(board);
    const squarePlacements = cache.placementsByItemId.get('P07') ?? [];

    expect(new Set(squarePlacements.map((placement) => placement.rotation))).toEqual(new Set([0]));
    expect(squarePlacements).toHaveLength(1);
  });

  it('can skip an uncovered pivot cell to reach a later optimal placement', () => {
    const board = boardFromRows([
      '.xxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxx..xxxx',
      'xxx..xxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P07: 1 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(4);
    expect(result.usedCounts).toEqual({ P07: 1 });
  });

  it('uses rotations when an item cannot fit in its base orientation', () => {
    const board = boardFromRows([
      '..xxxxxxx',
      '..xxxxxxx',
      '..xxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ]);
    const result = solveInventory(board, { P05: 1 }, { maxSolutions: 3, timeLimitMs: 100 });

    expect(result.bestFilledCells).toBe(4);
    expect(result.solutions[0].placements[0].rotation).not.toBe(0);
  });

  it('returns a valid best-so-far result with a tiny time limit', () => {
    const result = solveInventory(
      createFullBoard(),
      {
        P01: 8,
        P02: 8,
        P03: 8,
        P12: 8,
        P14: 8,
      },
      { maxSolutions: 2, timeLimitMs: 0 },
    );

    expect(result.bestFilledCells).toBeGreaterThanOrEqual(0);
    expect(result.bestFilledCells).toBeLessThanOrEqual(result.usableCells);
    expect(result.solutions.length).toBeLessThanOrEqual(2);
    expect(result.searchedNodes).toBeGreaterThan(0);
    expect(['complete', 'time-limit']).toContain(result.stopReason);
  });

  it('reports time-limit and keeps a best-so-far solution under an extremely small time limit', () => {
    const result = solveInventory(
      createFullBoard(),
      {
        P01: 20,
        P02: 20,
        P03: 20,
        P12: 20,
        P14: 20,
      },
      { maxSolutions: 2, timeLimitMs: 0 },
    );

    expect(result.stopReason).toBe('time-limit');
    expect(result.solutions.length).toBeGreaterThan(0);
    expect(result.bestFilledCells).toBeGreaterThanOrEqual(0);
  });

  it('respects maxSolutions when many equivalent placements are possible', () => {
    const result = solveInventory(createFullBoard(), { P11: 2 }, { maxSolutions: 2, timeLimitMs: 100 });

    expect(result.solutions.length).toBeLessThanOrEqual(2);
    expect(result.solutions.every((solution) => solution.filledCells === result.bestFilledCells)).toBe(true);
  });

  it('returns deterministic first solution for the same input', () => {
    const board = boardFromRows([
      '.........',
      '.x.....x.',
      '.........',
      '...xxx...',
      '.........',
      '...xxx...',
      '.........',
      '.x.....x.',
      '.........',
    ]);
    const counts = { P03: 1, P06: 2, P08: 2, P10: 2 };
    const first = solveInventory(board, counts, { maxSolutions: 3, timeLimitMs: 500 });
    const second = solveInventory(board, counts, { maxSolutions: 3, timeLimitMs: 500 });

    expect(first.bestFilledCells).toBe(second.bestFilledCells);
    expect(placementItemIds(first)).toEqual(placementItemIds(second));
    expect(solutionSignature(first)).toBe(solutionSignature(second));
  });

  it('summarizes diagnostic fields for a medium mixed inventory case', () => {
    const counts = { P03: 1, P07: 2, P08: 2, P10: 3, P11: 4 };
    const result = solveInventory(createFullBoard(), counts, { maxSolutions: 3, timeLimitMs: 500 });
    const diagnostics = summarizeSolverResult(counts, result);

    expect(diagnostics).toMatchObject({
      usableCells: 81,
      selectedItemArea: getSelectedItemArea(counts),
      filledCells: result.bestFilledCells,
      placedItemArea: result.placedItemArea,
      targetFilledCells: result.targetFilledCells,
      priorityScore: result.priorityScore,
      mustUseSatisfied: result.mustUseSatisfied,
      searchedNodes: result.searchedNodes,
      stopReason: result.stopReason,
    });
    expect(diagnostics.selectedPlacementRatio).toBe(result.bestFilledCells / diagnostics.selectedItemArea);
    expect(diagnostics.usedCounts).toEqual(counts);
    expect(diagnostics.unusedCounts).toEqual({});
  });

  it('summarizes diagnostic fields for irregular, under-capacity, over-capacity, and pressure cases', () => {
    const cases: Array<{ name: string; board: Board; counts: Record<string, number> }> = [
      {
        name: 'irregular board',
        board: boardFromRows([
          '.x.x.x.x.',
          '.........',
          'x.......x',
          '.........',
          '.x.xxx.x.',
          '.........',
          'x.......x',
          '.........',
          '.x.x.x.x.',
        ]),
        counts: { P06: 3, P08: 2, P10: 2 },
      },
      {
        name: 'under capacity',
        board: createFullBoard(),
        counts: { P12: 1, P13: 1, P11: 2 },
      },
      {
        name: 'over capacity',
        board: createDefaultBoard(),
        counts: { P14: 12, P12: 6, P11: 10 },
      },
      {
        name: 'many identical items pressure',
        board: createFullBoard(),
        counts: { P11: 90 },
      },
    ];

    cases.forEach(({ board, counts }) => {
      const result = solveInventory(board, counts, { maxSolutions: 3, timeLimitMs: 500 });
      const diagnostics = summarizeSolverResult(counts, result);

      expect(diagnostics.usableCells).toBe(result.usableCells);
      expect(diagnostics.selectedItemArea).toBe(getSelectedItemArea(counts));
      expect(diagnostics.filledCells).toBeLessThanOrEqual(diagnostics.usableCells);
      expect(diagnostics.selectedPlacementRatio).toBeLessThanOrEqual(1);
      expect(diagnostics.searchedNodes).toBeGreaterThan(0);
      expect(['complete', 'time-limit']).toContain(diagnostics.stopReason);
    });
  });

  it('considers mid-priority cross items in a time-limited dense inventory', () => {
    const board: Board = [
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [false, false, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true],
    ];

    const result = solveInventory(
      board,
      {
        P01: 5,
        P05: 1,
        P09: 3,
        P10: 1,
        P11: 1,
        P12: 2,
        P13: 1,
        P14: 2,
      },
      { maxSolutions: 3, timeLimitMs: 1000 },
    );

    expect(result.solutions.some((solution) => solution.placements.some((placement) => placement.itemId === 'P12'))).toBe(true);
  });

  describe('priority and must-use behavior', () => {
    it('prioritizes higher-priority items when selected item area exceeds usable cells', () => {
      const board = createDefaultBoard();
      const counts = { P14: 6, P12: 3, P11: 8 };
      const options = {
        maxSolutions: 3,
        timeLimitMs: 500,
        priorityByItemId: { P12: 5, P11: 3, P14: 1 },
      };

      const result = solveInventory(board, counts, options);

      expect(result.solutions[0].placements.some((placement) => placement.itemId === 'P12')).toBe(true);
    });

    it('keeps must-use items in the best solution when they can be placed', () => {
      const board = createFullBoard();
      const counts = { P14: 12, P12: 1 };
      const options = {
        maxSolutions: 3,
        timeLimitMs: 500,
        mustUseItemIds: ['P12'],
      };

      const result = solveInventory(board, counts, options);

      expect(result.solutions[0].placements.some((placement) => placement.itemId === 'P12')).toBe(true);
      expect(result.mustUseSatisfied).toBe(true);
    });
  });
});
