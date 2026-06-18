export type BackpackPresetId = 'character-1' | 'character-2' | 'character-3' | 'character-4' | 'character-5';

export type BackpackPreset = {
  id: BackpackPresetId;
  rows: string[];
  enabled: boolean;
};

export const backpackPresets: BackpackPreset[] = [
  {
    id: 'character-1',
    enabled: true,
    rows: [
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ],
  },
  {
    id: 'character-2',
    enabled: true,
    rows: [
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xx.....xx',
      'xx.....xx',
      'xx.....xx',
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ],
  },
  {
    id: 'character-3',
    enabled: true,
    rows: [
      'xxxxxxxxx',
      'xxxx.xxxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxxx.xxxx',
      'xxxx.xxxx',
      'xxxxxxxxx',
    ],
  },
  {
    id: 'character-4',
    enabled: true,
    rows: [
      'xxxxxxxxx',
      'xxxxxxxxx',
      'xxxx.xxxx',
      'xx.....xx',
      'xxx...xxx',
      'xxx...xxx',
      'xxx...xxx',
      'xxxxxxxxx',
      'xxxxxxxxx',
    ],
  },
  {
    id: 'character-5',
    enabled: false,
    rows: [],
  },
];
