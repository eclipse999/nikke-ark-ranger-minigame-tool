import type { Cell, ItemDefinition, Rotation, Shape } from './types';

const rotationAngles: Rotation[] = [0, 90, 180, 270];

const itemBaseShapes: Array<Pick<ItemDefinition, 'id' | 'baseShape'>> = [
  { id: 'P01', baseShape: ['X.', 'X.', 'X.', 'XX'] },
  { id: 'P02', baseShape: ['.X', '.X', 'XX', '.X'] },
  { id: 'P03', baseShape: ['X.', 'X.', 'XX', 'X.'] },
  { id: 'P04', baseShape: ['XXX', '.X.', '.X.'] },
  { id: 'P05', baseShape: ['XXX', 'X..'] },
  { id: 'P06', baseShape: ['.XX', 'XX.'] },
  { id: 'P07', baseShape: ['XX', 'XX'] },
  { id: 'P08', baseShape: ['XX', 'X.'] },
  { id: 'P09', baseShape: ['X', 'X', 'X'] },
  { id: 'P10', baseShape: ['X', 'X'] },
  { id: 'P11', baseShape: ['X'] },
  { id: 'P12', baseShape: ['.X.', 'XXX', '.X.'] },
  { id: 'P13', baseShape: ['XXX', '.X.'] },
  { id: 'P14', baseShape: ['XXX', 'XXX'] },
  { id: 'P15', baseShape: ['XX.', '.XX'] },
  { id: 'P16', baseShape: ['XXX', 'X..', 'X..'] },
];

export function parseShape(shapeRows: string[]): Cell[] {
  const cells: Cell[] = [];

  shapeRows.forEach((line, row) => {
    [...line].forEach((value, col) => {
      if (value === 'X') {
        cells.push({ row, col });
      }
    });
  });

  return normalizeCells(cells);
}

export function normalizeCells(cells: Cell[]): Cell[] {
  if (cells.length === 0) {
    return [];
  }

  const minRow = Math.min(...cells.map((cell) => cell.row));
  const minCol = Math.min(...cells.map((cell) => cell.col));

  return cells
    .map((cell) => ({ row: cell.row - minRow, col: cell.col - minCol }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

function rotateCell(cell: Cell, rotation: Rotation): Cell {
  switch (rotation) {
    case 0:
      return cell;
    case 90:
      return { row: cell.col, col: -cell.row };
    case 180:
      return { row: -cell.row, col: -cell.col };
    case 270:
      return { row: -cell.col, col: cell.row };
  }
}

function makeShape(cells: Cell[], rotation: Rotation): Shape {
  const normalized = normalizeCells(cells.map((cell) => rotateCell(cell, rotation)));
  const width = normalized.length === 0 ? 0 : Math.max(...normalized.map((cell) => cell.col)) + 1;
  const height = normalized.length === 0 ? 0 : Math.max(...normalized.map((cell) => cell.row)) + 1;

  return {
    cells: normalized,
    width,
    height,
    area: normalized.length,
    rotation,
  };
}

function shapeKey(shape: Shape): string {
  return shape.cells.map((cell) => `${cell.row},${cell.col}`).join('|');
}

export function createRotations(baseShape: string[]): Shape[] {
  const baseCells = parseShape(baseShape);
  const unique = new Map<string, Shape>();

  rotationAngles.forEach((rotation) => {
    const shape = makeShape(baseCells, rotation);
    const key = shapeKey(shape);
    if (!unique.has(key)) {
      unique.set(key, shape);
    }
  });

  return [...unique.values()];
}

export const items: ItemDefinition[] = itemBaseShapes.map((item) => ({
  ...item,
  rotations: createRotations(item.baseShape),
}));

export const itemById = new Map(items.map((item) => [item.id, item]));
