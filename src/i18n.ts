export type Locale = 'zh-Hant' | 'en';

type Messages = {
  appTitle: string;
  appDescription: string;
  github: string;
  board: string;
  backpackPreset: string;
  backpackPresetLabels: Record<string, string>;
  items: string;
  results: string;
  resetBoard: string;
  fullBoard: string;
  clearItems: string;
  clearMustUse: string;
  solve: string;
  solving: string;
  language: string;
  quantity: string;
  mustUse: string;
  rotations: string;
  usedItems: string;
  unusedItems: string;
  noUnusedItems: string;
  usableCells: string;
  filledCells: string;
  placementRatio: string;
  mustUseSatisfied: string;
  mustUseMissing: string;
  utilization: string;
  noResult: string;
  provenOptimal: string;
  timeBest: string;
  searchedNodes: string;
  unavailable: string;
  available: string;
  occupied: string;
  toggleAvailability: string;
  resultStatus: {
    complete: string;
    good: string;
    notice: string;
    needsAdjustment: string;
  };
};

export const messages: Record<Locale, Messages> = {
  'zh-Hant': {
    appTitle: 'NIKKE Ark Ranger 小遊戲背包最佳化工具',
    appDescription: '切換可用格、設定道具數量，快速計算最佳堆疊與背包利用率。',
    github: 'GitHub ↗',
    board: '① 背包 9x9',
    backpackPreset: '預設背包',
    backpackPresetLabels: {
      'character-1': '角色 1',
      'character-2': '角色 2',
      'character-3': '角色 3',
      'character-4': '角色 4',
      'character-5': '角色 5（未開放）',
    },
    items: '② 道具數量',
    results: '③ 結果',
    resetBoard: '重置',
    fullBoard: '全部可用',
    clearItems: '清空道具',
    clearMustUse: '清除必用',
    solve: '執行最佳化',
    solving: '計算中...',
    language: '語言',
    quantity: '數量',
    mustUse: '必用',
    rotations: '旋轉',
    usedItems: '使用數量',
    unusedItems: '未放入道具',
    noUnusedItems: '所有所選道具皆已放入。',
    usableCells: '可用格',
    filledCells: '已填入',
    placementRatio: '道具放入率',
    mustUseSatisfied: '必用道具皆已放入',
    mustUseMissing: '必用道具未完全放入',
    utilization: '背包使用率',
    noResult: '尚未計算，或目前沒有可擺放道具。',
    provenOptimal: '已證明最佳',
    timeBest: '時間內最佳',
    searchedNodes: '搜尋節點',
    unavailable: '不可用',
    available: '可用',
    occupied: '已填入',
    toggleAvailability: '點擊切換可用 / 不可用',
    resultStatus: {
      complete: '完成',
      good: '良好',
      notice: '注意',
      needsAdjustment: '需調整',
    },
  },
  en: {
    appTitle: 'NIKKE Ark Ranger Minigame Inventory Optimizer',
    appDescription: 'Toggle cells, set item counts, then optimize placement and inventory utilization.',
    github: 'GitHub ↗',
    board: '① Backpack 9x9',
    backpackPreset: 'Inventory Preset',
    backpackPresetLabels: {
      'character-1': 'Character 1',
      'character-2': 'Character 2',
      'character-3': 'Character 3',
      'character-4': 'Character 4',
      'character-5': 'Character 5 (Locked)',
    },
    items: '② Items',
    results: '③ Result',
    resetBoard: 'Reset',
    fullBoard: 'All Available',
    clearItems: 'Clear Items',
    clearMustUse: 'Clear Must-use',
    solve: 'Optimize',
    solving: 'Optimizing...',
    language: 'Language',
    quantity: 'Qty',
    mustUse: 'Must-use',
    rotations: 'Rotations',
    usedItems: 'Items Used',
    unusedItems: 'Unplaced items',
    noUnusedItems: 'All selected items were placed.',
    usableCells: 'Usable',
    filledCells: 'Filled',
    placementRatio: 'Items Placed',
    mustUseSatisfied: 'All must-use items placed',
    mustUseMissing: 'Must-use items missing',
    utilization: 'Utilization',
    noResult: 'Run the optimizer, or add items that can be placed.',
    provenOptimal: 'Proven optimal',
    timeBest: 'Best within time',
    searchedNodes: 'Searched nodes',
    unavailable: 'Unavailable',
    available: 'Available',
    occupied: 'Occupied',
    toggleAvailability: 'Click to toggle available / unavailable',
    resultStatus: {
      complete: 'Complete',
      good: 'Good',
      notice: 'Notice',
      needsAdjustment: 'Needs adjustment',
    },
  },
};
