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
  solve: string;
  importScreenshot: string;
  importingScreenshot: string;
  importFailed: string;
  language: string;
  quantity: string;
  rotations: string;
  usableCells: string;
  filledCells: string;
  utilization: string;
  noResult: string;
  solution: string;
  previous: string;
  next: string;
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
      '點擊網格切換可用/不可用(x)。設置各道具數量，實時計算並展示最優堆積方案及利用率。最佳用途：幫你整體包包',
    board: '背包 9x9',
    items: '道具數量',
    results: '結果',
    resetBoard: '重置背包狀態',
    fullBoard: '全部可用',
    clearItems: '清空道具',
    solve: '執行最佳化',
    importScreenshot: '匯入截圖',
    importingScreenshot: '辨識中...',
    importFailed: '截圖匯入失敗，請確認圖片格式後再試一次。',
    language: '語言',
    quantity: '數量',
    rotations: '旋轉',
    usableCells: '可用格',
    filledCells: '填入格',
    utilization: '利用率',
    noResult: '尚未計算，或目前沒有可擺放道具。',
    solution: '解法',
    previous: '上一個',
    next: '下一個',
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
      'Click the grid to toggle available/unavailable (x). Set each item quantity, calculate in real time, and show the optimal stacking plan and utilization. Best use: helping you organize the whole inventory.',
    board: 'Inventory 9x9',
    items: 'Item Quantities',
    results: 'Result',
    resetBoard: 'Reset Board',
    fullBoard: 'All Available',
    clearItems: 'Clear Items',
    solve: 'Optimize',
    importScreenshot: 'Import Screenshot',
    importingScreenshot: 'Reading...',
    importFailed: 'Screenshot import failed. Check the image format and try again.',
    language: 'Language',
    quantity: 'Qty',
    rotations: 'Rotations',
    usableCells: 'Usable',
    filledCells: 'Filled',
    utilization: 'Utilization',
    noResult: 'Run the optimizer, or add items that can be placed.',
    solution: 'Solution',
    previous: 'Previous',
    next: 'Next',
    provenOptimal: 'Proven optimal',
    timeBest: 'Best within time',
    searchedNodes: 'Searched nodes',
    unavailable: 'Unavailable',
    available: 'Available',
    occupied: 'Occupied',
  },
};
