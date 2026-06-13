import { describe, expect, it } from 'vitest';
import { getMissingItemColorIds, itemColors } from './itemColors';

function parseHue(color: string): number {
  const match = /^hsl\((\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%\)$/.exec(color);
  if (!match) {
    throw new Error(`Unsupported color format: ${color}`);
  }

  return Number(match[1]);
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b);
  return Math.min(distance, 360 - distance);
}

describe('item colors', () => {
  it('defines a color for every item', () => {
    expect(getMissingItemColorIds()).toEqual([]);
  });

  it('uses unique colors for each item', () => {
    expect(new Set(itemColors.values()).size).toBe(itemColors.size);
  });

  it('keeps item hues visually separated', () => {
    const entries = [...itemColors.entries()].map(([itemId, color]) => ({ itemId, hue: parseHue(color) }));

    entries.forEach((current, index) => {
      entries.slice(index + 1).forEach((next) => {
        expect.soft(hueDistance(current.hue, next.hue), `${current.itemId} and ${next.itemId}`).toBeGreaterThanOrEqual(12);
      });
    });
  });

  it('keeps P11 and P12 clearly distinguishable', () => {
    expect(hueDistance(parseHue(itemColors.get('P11')!), parseHue(itemColors.get('P12')!))).toBeGreaterThanOrEqual(40);
  });
});
