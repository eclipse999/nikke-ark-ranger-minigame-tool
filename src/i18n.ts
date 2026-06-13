export type Locale = 'zh-Hant' | 'en';

type Messages = {
  appTitle: string;
  appDescription: string;
  board: string;
  items: string;
  results: string;
  resetBoard: string;
  fullBoard: string;
  clearItems: string;
  resetPriorities: string;
  solve: string;
  priorityHint: string;
  language: string;
  quantity: string;
  priority: string;
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
};

export const messages: Record<Locale, Messages> = {
  'zh-Hant': {
    appTitle: 'NIKKE Ark Ranger 小遊戲背包最佳化工具',
    appDescription:
      '點擊或拖曳網格把不可用(x)切換為可用。設置各道具數量，實時計算並展示最優堆積方案及利用率。最佳用途：幫你整理包包',
    board: '背包 9x9',
    items: '道具數量',
    results: '結果',
    resetBoard: '重置背包狀態',
    fullBoard: '全部可用',
    clearItems: '清空道具',
    resetPriorities: '重置優先權',
    solve: '執行最佳化',
    priorityHint: '優先權數字越大越優先；空間不足時會偏好權重較高的道具。',
    language: '語言',
    quantity: '數量',
    priority: '優先權',
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
  },
  en: {
    appTitle: 'NIKKE Ark Ranger Minigame Inventory Optimizer',
    appDescription:
      'Click or drag across cells to mark unavailable cells (x) as available. Set each item quantity, calculate in real time, and show the optimal stacking plan and utilization. Best use: helping you organize the whole inventory.',
    board: 'Inventory 9x9',
    items: 'Item Quantities',
    results: 'Result',
    resetBoard: 'Reset Board',
    fullBoard: 'All Available',
    clearItems: 'Clear Items',
    resetPriorities: 'Reset Priority',
    solve: 'Optimize',
    priorityHint: 'Higher priority numbers are preferred when space is limited.',
    language: 'Language',
    quantity: 'Qty',
    priority: 'Priority',
    mustUse: 'Must-use',
    rotations: 'Rotations',
    usedItems: 'Items Used',
    unusedItems: 'Items Not Placed',
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
  },
};
