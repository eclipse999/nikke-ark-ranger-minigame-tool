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

  it('defines character 4 with the provided 9x9 layout', () => {
    expect(boardToRows('character-4')).toEqual([
      '000000000',
      '000000000',
      '000010000',
      '001111100',
      '000111000',
      '000111000',
      '000111000',
      '000000000',
      '000000000',
    ]);
    expect(countUsableCells(createDefaultBoard('character-4'))).toBe(15);
  });

  it('defines character 5 with the provided 9x9 layout', () => {
    expect(boardToRows('character-5')).toEqual([
      '000000000',
      '000000000',
      '001110000',
      '001111000',
      '001111100',
      '000110000',
      '000010000',
      '000000000',
      '000000000',
    ]);
    expect(countUsableCells(createDefaultBoard('character-5'))).toBe(15);
  });

  it('keeps all current character presets enabled', () => {
    expect(backpackPresets.filter((preset) => !preset.enabled).map((preset) => preset.id)).toEqual([]);
  });

  it('can rebuild the current selected preset for reset behavior', () => {
    const selectedPresetId: BackpackPresetId = 'character-2';
    const editedBoard = createDefaultBoard(selectedPresetId);
    editedBoard[0][0] = true;

    expect(editedBoard).not.toEqual(createDefaultBoard(selectedPresetId));
    expect(createDefaultBoard(selectedPresetId)).toEqual(createDefaultBoard('character-2'));
  });
});
