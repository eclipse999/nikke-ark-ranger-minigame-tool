import { BOARD_SIZE } from './board';
import { items } from './items';
import type { Board, Cell, Shape } from './types';

type GridBox = {
  x: number;
  y: number;
  size: number;
};

type ItemCandidate = {
  itemId: string;
  shape: Shape;
  row: number;
  col: number;
  mask: bigint;
  area: number;
};

export type ScreenshotImportResult = {
  board: Board;
  counts: Record<string, number>;
  confidence: {
    board: number;
    items: number;
  };
  warnings: string[];
};

function bitFor(row: number, col: number): bigint {
  return 1n << BigInt(row * BOARD_SIZE + col);
}

function cellMask(cells: Cell[]): bigint {
  return cells.reduce((mask, cell) => mask | bitFor(cell.row, cell.col), 0n);
}

function absoluteCells(shape: Shape, row: number, col: number): Cell[] {
  return shape.cells.map((cell) => ({ row: row + cell.row, col: col + cell.col }));
}

function occupiedMaskFromGrid(occupied: boolean[][]): bigint {
  let mask = 0n;

  occupied.forEach((rowCells, row) => {
    rowCells.forEach((filled, col) => {
      if (filled) {
        mask |= bitFor(row, col);
      }
    });
  });

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

function firstSetCell(mask: bigint): Cell | null {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if ((mask & bitFor(row, col)) !== 0n) {
        return { row, col };
      }
    }
  }

  return null;
}

export function inferItemCountsFromOccupiedGrid(occupied: boolean[][]): { counts: Record<string, number>; uncoveredCells: number } {
  const targetMask = occupiedMaskFromGrid(occupied);
  const candidates: ItemCandidate[] = [];

  items.forEach((item) => {
    item.rotations.forEach((shape) => {
      for (let row = 0; row <= BOARD_SIZE - shape.height; row += 1) {
        for (let col = 0; col <= BOARD_SIZE - shape.width; col += 1) {
          const mask = cellMask(absoluteCells(shape, row, col));
          if ((mask & targetMask) === mask) {
            candidates.push({ itemId: item.id, shape, row, col, mask, area: shape.area });
          }
        }
      }
    });
  });

  const byCell = new Map<string, ItemCandidate[]>();
  candidates.forEach((candidate) => {
    candidate.shape.cells.forEach((cell) => {
      const key = `${candidate.row + cell.row},${candidate.col + cell.col}`;
      byCell.set(key, [...(byCell.get(key) ?? []), candidate]);
    });
  });
  byCell.forEach((cellCandidates) => {
    cellCandidates.sort((a, b) => b.area - a.area || a.itemId.localeCompare(b.itemId));
  });

  let bestCounts: Record<string, number> = {};
  let bestCovered = 0;
  let searchedNodes = 0;
  const maxNodes = 25000;
  const workingCounts: Record<string, number> = {};

  function remember(remainingMask: bigint) {
    const covered = countBits(targetMask) - countBits(remainingMask);
    if (covered > bestCovered) {
      bestCovered = covered;
      bestCounts = { ...workingCounts };
    }
  }

  function dfs(remainingMask: bigint): boolean {
    searchedNodes += 1;
    if (searchedNodes > maxNodes || remainingMask === 0n) {
      remember(remainingMask);
      return remainingMask === 0n;
    }

    const cell = firstSetCell(remainingMask);
    if (!cell) {
      remember(remainingMask);
      return true;
    }

    const cellCandidates = byCell.get(`${cell.row},${cell.col}`) ?? [];
    for (const candidate of cellCandidates) {
      if ((candidate.mask & remainingMask) !== candidate.mask) {
        continue;
      }

      workingCounts[candidate.itemId] = (workingCounts[candidate.itemId] ?? 0) + 1;
      if (dfs(remainingMask & ~candidate.mask)) {
        return true;
      }
      workingCounts[candidate.itemId] -= 1;
      if (workingCounts[candidate.itemId] === 0) {
        delete workingCounts[candidate.itemId];
      }
    }

    remember(remainingMask);
    return false;
  }

  dfs(targetMask);

  return {
    counts: Object.fromEntries(items.map((item) => [item.id, bestCounts[item.id] ?? 0])),
    uncoveredCells: countBits(targetMask) - bestCovered,
  };
}

function pixelOffset(imageData: ImageData, x: number, y: number): number {
  return (y * imageData.width + x) * 4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function isBrightFramePixel(imageData: ImageData, x: number, y: number): boolean {
  const offset = pixelOffset(imageData, x, y);
  const r = imageData.data[offset];
  const g = imageData.data[offset + 1];
  const b = imageData.data[offset + 2];
  return luminance(r, g, b) > 185 && saturation(r, g, b) < 0.32;
}

function findInventoryGridBox(imageData: ImageData): { box: GridBox; confidence: number } {
  const { width, height } = imageData;
  const scanTop = Math.floor(height * 0.1);
  const scanBottom = Math.floor(height * 0.72);
  const minX = Math.floor(width * 0.12);
  const maxX = Math.floor(width * 0.88);
  const rowScores: Array<{ y: number; score: number }> = [];

  for (let y = scanTop; y < scanBottom; y += 2) {
    let score = 0;
    for (let x = minX; x < maxX; x += 3) {
      if (isBrightFramePixel(imageData, x, y)) {
        score += 1;
      }
    }
    rowScores.push({ y, score });
  }

  const wideRowThreshold = (maxX - minX) / 5;
  const strongRows = rowScores.filter((row) => row.score > wideRowThreshold);
  const topRow = strongRows[0]?.y ?? Math.floor(height * 0.12);
  const columnScanBottom = Math.min(scanBottom, Math.floor(topRow + width * 0.7));

  const columnScores: Array<{ x: number; score: number }> = [];
  for (let x = minX; x < maxX; x += 2) {
    let score = 0;
    for (let y = topRow; y < columnScanBottom; y += 3) {
      if (isBrightFramePixel(imageData, x, y)) {
        score += 1;
      }
    }
    columnScores.push({ x, score });
  }

  const strongColumns = columnScores.filter((column) => column.score > Math.max(24, (columnScanBottom - topRow) / 16));
  const leftColumn = strongColumns[0]?.x ?? Math.floor(width * 0.18);
  const rightColumn = strongColumns.at(-1)?.x ?? Math.floor(width * 0.82);
  const panelWidth = Math.max(1, rightColumn - leftColumn);
  const inset = panelWidth * 0.055;
  const size = panelWidth - inset * 2;
  const box = {
    x: leftColumn + inset,
    y: topRow + inset,
    size,
  };
  const confidence = strongRows.length > 0 && strongColumns.length >= 2 ? 0.72 : 0.42;

  return { box, confidence };
}

function sampleCell(imageData: ImageData, box: GridBox, row: number, col: number) {
  const cellSize = box.size / BOARD_SIZE;
  const fromX = Math.max(0, Math.floor(box.x + col * cellSize + cellSize * 0.18));
  const toX = Math.min(imageData.width - 1, Math.floor(box.x + (col + 1) * cellSize - cellSize * 0.18));
  const fromY = Math.max(0, Math.floor(box.y + row * cellSize + cellSize * 0.18));
  const toY = Math.min(imageData.height - 1, Math.floor(box.y + (row + 1) * cellSize - cellSize * 0.18));

  let totalLuminance = 0;
  let totalSaturation = 0;
  let vividPixels = 0;
  let brightPixels = 0;
  let samples = 0;

  for (let y = fromY; y <= toY; y += 3) {
    for (let x = fromX; x <= toX; x += 3) {
      const offset = pixelOffset(imageData, x, y);
      const r = imageData.data[offset];
      const g = imageData.data[offset + 1];
      const b = imageData.data[offset + 2];
      const luma = luminance(r, g, b);
      const sat = saturation(r, g, b);
      totalLuminance += luma;
      totalSaturation += sat;
      if (sat > 0.32 && luma > 45) {
        vividPixels += 1;
      }
      if (luma > 125) {
        brightPixels += 1;
      }
      samples += 1;
    }
  }

  return {
    luminance: samples === 0 ? 0 : totalLuminance / samples,
    saturation: samples === 0 ? 0 : totalSaturation / samples,
    vividRatio: samples === 0 ? 0 : vividPixels / samples,
    brightRatio: samples === 0 ? 0 : brightPixels / samples,
  };
}

export function detectInventoryGrid(imageData: ImageData): {
  board: Board;
  occupied: boolean[][];
  confidence: number;
  warnings: string[];
} {
  const { box, confidence } = findInventoryGridBox(imageData);
  const samples = Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => sampleCell(imageData, box, row, col)),
  );
  const occupied = samples.map((rowSamples) =>
    rowSamples.map((sample) => sample.vividRatio > 0.08 || sample.brightRatio > 0.2 || (sample.saturation > 0.22 && sample.luminance > 58)),
  );
  const board = samples.map((rowSamples, row) =>
    rowSamples.map((sample, col) => occupied[row][col] || sample.luminance > 20 || sample.brightRatio > 0.015),
  );
  const filledCells = occupied.flat().filter(Boolean).length;
  const usableCells = board.flat().filter(Boolean).length;
  const warnings: string[] = [];

  if (confidence < 0.6) {
    warnings.push('無法高信心定位 9x9 道具欄，請確認匯入後的格子狀態。');
  }
  if (filledCells === 0) {
    warnings.push('未偵測到已放置道具，請確認截圖是否包含上方道具欄。');
  }
  if (usableCells === BOARD_SIZE * BOARD_SIZE) {
    warnings.push('目前判斷 9x9 格皆為可用；若遊戲實際尚未全開，請手動修正不可用格。');
  }

  return { board, occupied, confidence, warnings };
}

export function importScreenshotImage(imageData: ImageData): ScreenshotImportResult {
  const detection = detectInventoryGrid(imageData);
  const matched = inferItemCountsFromOccupiedGrid(detection.occupied);
  const warnings = [...detection.warnings];

  if (matched.uncoveredCells > 0) {
    warnings.push(`有 ${matched.uncoveredCells} 個已佔用格無法對應到已知道具，請手動修正數量。`);
  }

  const occupiedCells = detection.occupied.flat().filter(Boolean).length;
  const itemConfidence = occupiedCells === 0 ? 0 : Math.max(0.2, 1 - matched.uncoveredCells / occupiedCells);

  return {
    board: detection.board,
    counts: matched.counts,
    confidence: {
      board: detection.confidence,
      items: itemConfidence,
    },
    warnings,
  };
}

export async function readImageFile(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not available in this browser.');
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
