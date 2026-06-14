# NIKKE Ark Ranger Minigame Tool

<img src="https://github.com/user-attachments/assets/6b846c7b-812c-46cb-b56d-65159ad3868c" width="600" />

繁體中文 | [English](README.en.md)

背包最佳化工具：為手遊《勝利女神：NIKKE》Ark Ranger 小遊戲設計的 9×9 背包空間規劃器。

輸入棋盤可用區域、道具數量與可選的優先權設定，求解器會在時間限制內計算較佳的擺放方案。

> 本工具參考並重製自 [nikke-mini-game.netlify.app](https://nikke-mini-game.netlify.app/)，保留其三欄式操作介面，並新增**道具旋轉**支援。

## 線上版本

已部署到 Cloudflare Pages，可直接使用：

- [繁體中文](https://nikke-ark-ranger-minigame-tool.pages.dev/)
- [English](https://nikke-ark-ranger-minigame-tool.pages.dev/?lang=en)

## 功能

- **9×9 背包棋盤** — 點擊或拖曳格子把不可用（x）切換為可用，支援重置及一鍵全開
- **P01–P14 完整道具** — 全部 14 種道具，自動產生 0°/90°/180°/270° 旋轉形狀，去除重複
- **道具優先權 1–5** — 每種道具可設定優先權；數字越大權重越高，空間不足時會優先保留
- **必用道具** — 可標記 must-use，道具互斥時優先滿足必用道具，結果區會提示是否全部放入
- **未放入提示** — 顯示哪些道具已放入、哪些道具放不下，方便判斷取捨
- **回溯求解器** — 使用 placement cache 與 pivot cell DFS，含保守剪枝與時間上限（預設 1 秒）
- **最佳方案顯示** — 結果區顯示目前排序下的最佳擺放方案
- **雙語介面** — 繁體中文 / English，支援 URL 參數 `?lang=en` 指定預設語言，切換後即時生效
- **本機運行** — 純前端，無需後端，資料不離開瀏覽器

## 本地開發

### 環境需求

- [Node.js](https://nodejs.org/) 18 或以上

### 安裝與啟動

```bash
# 1. 複製專案
git clone https://github.com/eclipse999/nikke-ark-ranger-minigame-tool.git
cd nikke-ark-ranger-minigame-tool

# 2. 安裝依賴
npm install

# 3. 啟動開發伺服器
npm run dev
```

開啟瀏覽器前往 `http://localhost:5173`。

## 使用方式

1. **設定棋盤** — 點擊或拖曳格子把不可用（x）切換為可用；或按「全部可用」／「重置背包」
2. **輸入數量** — 在中央道具清單填入每種道具的持有數量
3. **設定取捨** — 優先權預設為 1，可調整到 5；數字越大權重越高，空間不足時越優先保留。勾選「必用」可要求求解器優先保留該道具
4. **開始計算** — 點擊「執行最佳化」，求解器會在時間限制內找出目前最佳擺法
5. **檢視結果** — 右側顯示可用格、已填入格數、道具放入率、背包使用率、已放入道具與未放入道具；有勾選必用時才會顯示必用狀態
6. **切換語言** — 點擊右上角語言按鈕

## 指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動 Vite 開發伺服器 |
| `npm run build` | 型別檢查 + 生產建置 |
| `npm run preview` | 預覽生產建置 |
| `npm test` | 執行單元測試（Vitest） |

## 技術棧

- **Vite** — 建置工具
- **React 19** — UI 框架
- **TypeScript** — 型別安全
- **Vitest** — 單元測試

## 專案架構

```
src/
├── types.ts        # 共用型別定義（Board, Shape, ItemDefinition, SolverResult）
├── board.ts        # 棋盤建立、複製、可用格計數
├── items.ts        # P01–P14 道具定義與旋轉形狀產生
├── solver.ts       # placement cache + pivot cell DFS 求解器（含時間限制與剪枝）
├── i18n.ts         # 繁體中文 / English 文案
├── App.tsx         # 主元件：三欄式 UI、求解狀態管理
├── main.tsx        # React 進入點
└── styles.css      # 全域樣式
```

### 求解策略與限制

- 搜尋前會針對目前棋盤預先建立合法 placement cache，排除不可用格與越界位置
- 使用 pivot cell DFS：每次選一個尚未處理的可用格，嘗試覆蓋該格的合法 placement，也保留 skip 該格的分支
- 最佳方案排序依序考慮：必用道具完成度、優先權權重、填入格數、未放入數量與穩定 signature；因此 UI 只顯示排序後的最佳方案
- 當所選道具總格數小於等於可用格時，目標填入格為所選總格數；超過可用格時，目標填入格為可用格
- 求解器保留時間上限（UI 預設 1 秒）。極端案例可能回傳時間內最佳解；只有 `provenOptimal` 為 `true` 時，才代表搜尋已完整完成並證明目前排序目標下的最佳解

## 授權

MIT
