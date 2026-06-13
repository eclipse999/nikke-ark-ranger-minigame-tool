import { describe, expect, it } from 'vitest';
import { importScreenshotImage } from './screenshotImport';

function makeImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(width * height * 4),
  } as ImageData;
}

function setPixel(imageData: ImageData, x: number, y: number, r: number, g: number, b: number) {
  const offset = (y * imageData.width + x) * 4;
  imageData.data[offset] = r;
  imageData.data[offset + 1] = g;
  imageData.data[offset + 2] = b;
  imageData.data[offset + 3] = 255;
}

describe('screenshot import', () => {
  it('imports only the 9x9 board state without item counts', () => {
    const imageData = makeImageData(100, 100);
    for (let x = 12; x <= 88; x += 1) {
      setPixel(imageData, x, 14, 230, 230, 230);
    }

    const result = importScreenshotImage(imageData);

    expect(result.board).toHaveLength(9);
    expect(result.board.every((row) => row.length === 9)).toBe(true);
    expect(result.confidence.board).toBeGreaterThan(0);
    expect('counts' in result).toBe(false);
  });
});
