import { describe, expect, it } from 'vitest';
import { createRotations, items } from './items';

describe('items', () => {
  it('defines P01 through P14 only', () => {
    expect(items.map((item) => item.id)).toEqual([
      'P01',
      'P02',
      'P03',
      'P04',
      'P05',
      'P06',
      'P07',
      'P08',
      'P09',
      'P10',
      'P11',
      'P12',
      'P13',
      'P14',
    ]);
  });

  it('keeps P03 as the provided vertical five-cell shape', () => {
    expect(items.find((entry) => entry.id === 'P03')?.baseShape).toEqual(['X.', 'X.', 'XX', 'X.']);
  });

  it('generates unique rotations for symmetric shapes', () => {
    expect(createRotations(['XX', 'XX'])).toHaveLength(1);
    expect(createRotations(['X'])).toHaveLength(1);
  });

  it('keeps multiple rotations for asymmetric shapes', () => {
    expect(createRotations(['XXX', 'X..']).length).toBeGreaterThan(1);
  });

  it('tracks shape dimensions and area', () => {
    const item = items.find((entry) => entry.id === 'P14');
    expect(item?.rotations[0]).toMatchObject({ width: 3, height: 2, area: 6 });
  });
});
