import { describe, expect, it } from 'vitest';
import { backpackPresets, type BackpackPresetId } from './backpackPresets';
import { countUsableCells, createDefaultBoard } from './board';

function boardToRows(presetId: BackpackPresetId): string[] {
  return createDefaultBoard(presetId).map((row) => row.map((cell) => (cell ? '1' : '0')).join(''));
}

describe('backpack presets', () => {
  it('keeps character 1 identical to the original default board', () => {
    expect(boardToRows('character-1')).toEqual([
      '000000000',
      '000000000',
      '000111000',
      '000111000',
      '000111000',
      '000111000',
      '000111000',
      '000000000',
      '000000000',
    ]);
    expect(createDefaultBoard()).toEqual(createDefaultBoard('character-1'));
  });

  it('defines character 2 with the provided 9x9 layout', () => {
    expect(boardToRows('character-2')).toEqual([
      '000000000',
      '000000000',
      '000000000',
      '001111100',
      '001111100',
      '001111100',
      '000000000',
      '000000000',
      '000000000',
    ]);
    expect(countUsableCells(createDefaultBoard('character-2'))).toBe(15);
  });

  it('defines character 3 with the provided 9x9 layout', () => {
    expect(boardToRows('character-3')).toEqual([
      '000000000',
      '000010000',
      '000111000',
      '000111000',
      '000111000',
      '000111000',
      '000010000',
      '000010000',
      '000000000',
    ]);
    expect(countUsableCells(createDefaultBoard('character-3'))).toBe(15);
  });

  it('keeps locked future character presets disabled', () => {
    expect(backpackPresets.filter((preset) => !preset.enabled).map((preset) => preset.id)).toEqual(['character-4', 'character-5']);
  });

  it('can rebuild the current selected preset for reset behavior', () => {
    const selectedPresetId: BackpackPresetId = 'character-2';
    const editedBoard = createDefaultBoard(selectedPresetId);
    editedBoard[0][0] = true;

    expect(editedBoard).not.toEqual(createDefaultBoard(selectedPresetId));
    expect(createDefaultBoard(selectedPresetId)).toEqual(createDefaultBoard('character-2'));
  });
});
