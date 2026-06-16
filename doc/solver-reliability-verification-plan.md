# 背包求解器可靠性驗證計畫書

## 1. 目標

建立一套可由 agent 直接執行的驗證流程，用來確認求解器在下列情境下行為可靠：

- 未設定必用時，優先尋找填入格數最多的方案。
- 若存在完整填滿背包的方案，求解器應在 UI 預設條件下找到完整填滿解。
- 設定必用後，求解器應先滿足必用道具，再追求填入格數。
- 結果不可出現重疊、越界、使用數量超過輸入數量、或 used/unused 數量不一致。

本計畫不要求證明「所有無限數量組合」都已被數學窮舉，因為道具數量理論上無上限。驗證範圍應分成可窮舉的小範圍 oracle、隨機壓力 fuzz、已知回歸案例、benchmark 四層，讓風險有明確覆蓋。

## 2. 目前產品語意

目前功能已移除優先權，只保留必用。

求解目標順序應為：

1. 必用道具完成度。
2. 填入格數。
3. 未放入道具數量。
4. 穩定 signature，用於 deterministic 排序。

因此未勾必用時，使用者直覺應成立：演算法會盡量塞滿。勾選必用時，演算法可以為了放入必用道具犧牲一部分填滿率，但同樣必用完成度下仍應盡量塞滿。

## 3. Agent 執行前檢查

開始前先確認工作區狀態：

```bash
git status --short
rg -n "priority|Priority|優先權|priorityByItemId|priorityScore" src README.md README.en.md
npm test
npm run build
npm run benchmark:solver
```

若 `rg` 找到優先權殘留，先釐清目前分支是否尚未套用「移除優先權」變更。若測試或 build 已失敗，先記錄失敗，再決定是否先修復基線。

## 4. 第一層：固定回歸案例

目的：鎖住用戶已回報過的實際失敗案例，避免之後再次退步。

建議放在 `src/solver.test.ts`，或若檔案過大，可新增 `src/solver.reliability.test.ts`。

必測案例：

1. 剛好填滿：
   - board: `createFullBoard()`
   - counts: `{ P02: 2, P05: 2, P06: 8, P07: 7, P09: 1 }`
   - options: `{ maxSolutions: 1, timeLimitMs: 1000 }`
   - 預期：`selectedItemArea === 81`、`targetFilledCells === 81`、`bestFilledCells === 81`、`unusedCounts === {}`

2. 超量但可填滿：
   - board: `createFullBoard()`
   - counts: `{ P02: 2, P05: 2, P06: 8, P07: 8, P09: 1 }`
   - options: `{ maxSolutions: 1, timeLimitMs: 1000 }`
   - 預期：`selectedItemArea === 85`、`targetFilledCells === 81`、`bestFilledCells === 81`

3. 同一組超量，P07 必用：
   - options 加上 `{ mustUseItemIds: ['P07'] }`
   - 預期：`bestFilledCells === 81`、`mustUseSatisfied === true`

4. 不可滿足必用：
   - 設計一個小棋盤，讓必用道具無法放入，但仍可放入其他道具。
   - 預期：`mustUseSatisfied === false`，且 `solutions[0]` 仍是合法 best-so-far，不應空掉。

## 5. 第二層：通用 invariant fuzz

目的：大量隨機測試合法性，不只看填滿率。

建議新增檔案：

- `src/solver.fuzz.test.ts`

測試方式：

- 使用 deterministic PRNG，不使用 `Math.random()`。
- 固定 seed，例如 `0x5eed`.
- 產生 1000 到 10000 組 counts。
- board 先覆蓋三類：
  - `createFullBoard()`
  - `createDefaultBoard()`
  - 3 到 5 個手寫 irregular board
- 每組 options 至少測：
  - 無必用。
  - 隨機選 0 到 2 種已選道具作為 must-use。

每次結果都要驗證：

- `bestFilledCells <= usableCells`
- `placedItemArea === bestFilledCells`
- `selectedItemArea` 等於 counts 換算面積。
- `targetFilledCells === Math.min(selectedItemArea, usableCells)`
- 每個 placement 的所有 cell 都在 board 可用格內。
- 任兩個 placement 不可覆蓋同一格。
- `usedCounts[itemId] <= selectedCounts[itemId]`
- `usedCounts + unusedCounts === selectedCounts`
- `solutions.length <= maxSolutions`
- 若 `mustUseSatisfied === true`，所有 must-use item 的 unused 必須為 0。
- 同一輸入連跑兩次，`bestFilledCells`、`usedCounts`、`unusedCounts` 和第一解 signature 應一致。

建議把合法性檢查抽成 helper：

```ts
function assertSolverResultIsLegal(board, counts, result) {
  // 驗證 placement cell、重疊、used/unused、targetFilledCells。
}
```

## 6. 第三層：小範圍 exact oracle

目的：用慢但完整的 oracle 比對快速 solver 的最佳性。

新增檔案建議：

- `src/solver.oracle.test.ts`

做法：

1. 建立測試專用 oracle solver。
2. oracle 可以慢，但必須完整搜尋。
3. 限制測試範圍，避免 CI 過慢。

建議 oracle 範圍：

- board 使用小型可用格區域，例如 3x3、4x4、5x5 的局部棋盤，其餘格設為 blocked。
- item 選小集合，例如：
  - `{ P07, P08, P10, P11 }`
  - `{ P05, P06, P07, P09 }`
  - `{ P02, P05, P06, P07, P09 }`
- count 上限小，例如每種 `0..3`。
- 跳過 `selectedItemArea === 0` 的空組合。

oracle 的 score 必須與正式 solver 一致：

```ts
score = [
  mustUseFilledArea,
  filledCells,
  -unusedItemCount,
]
```

驗證：

- 無必用時，正式 solver 的 `bestFilledCells` 必須等於 oracle。
- 有必用時，正式 solver 的 `mustUseSatisfied`、`mustUseUsedCounts`、`bestFilledCells` 必須符合 oracle 最佳 score。
- 若 oracle 顯示可完整填滿 `targetFilledCells`，正式 solver 在 `{ maxSolutions: 1, timeLimitMs: 1000 }` 下也應找到 `targetFilledCells`。

若 oracle 測試太慢，先降低 count 上限或 board 範圍，不要把 timeout 放寬到讓測試不可用。

## 7. 第四層：benchmark 壓力案例

目的：確認修正沒有讓搜尋效率退步，也確認固定案例 deterministic。

更新或擴充 `src/solver.benchmark.ts`：

- 保留既有 benchmark。
- 加入用戶回報的兩組 dense inventory。
- 加入 must-use pressure。
- 加入 over-capacity pressure。

benchmark 輸出應包含：

- `bestFilledCells`
- `selectedPlacementRatio`
- `mustUseSatisfied`
- `provenOptimal`
- `stopReason`
- `searchedNodes`
- `solutionsLength`

同一案例跑 5 次，若 metrics 或 first solution signature 不一致，要印出 warning 並調查。

## 8. 第五層：UI smoke 測試

目的：確認 UI 操作路徑沒有傳錯 options。

可選擇 Playwright 或手動 in-browser 檢查。若要自動化，新增：

- `src/App.smoke.test.tsx` 或 Playwright e2e 測試。

最低 smoke 應確認：

- 道具列沒有優先權控制。
- 可以輸入數量。
- 可以勾選/取消必用。
- 按「執行最佳化」後結果區出現。
- 勾選必用後，結果區只在有必用時顯示必用狀態。

若此專案目前沒有 DOM testing 或 Playwright 設定，不要為 smoke 測試引入大型框架。可先用 dev server + 手動檢查，並把 UI 自動化列為後續工作。

## 9. 建議執行順序

1. 補 `assertSolverResultIsLegal` helper。
2. 補固定回歸案例。
3. 補 deterministic fuzz。
4. 補 exact oracle 小範圍測試。
5. 擴充 benchmark。
6. 跑完整驗證。
7. 修復任何失敗案例。
8. 更新 README 或 doc 中的驗證說明。

## 10. 必跑命令

每次完成一個階段後至少跑：

```bash
npm test -- src/solver.test.ts
```

全部完成後必跑：

```bash
npm test
npm run build
npm run benchmark:solver
```

若在 Codex sandbox 中遇到 Vite/Vitest `spawn EPERM`，使用外部權限重跑同一命令，不要改用不等價的驗證方式。

## 11. 完成標準

可宣告完成時需同時符合：

- 所有用戶回報案例有固定測試。
- fuzz 測試至少跑過 1000 組 deterministic cases。
- exact oracle 至少覆蓋 2 種 board、2 組 item subset、含無必用與有必用。
- `npm test` 通過。
- `npm run build` 通過。
- `npm run benchmark:solver` 通過。
- README 或 doc 有說明目前最佳化語意：未勾必用時填滿優先，勾必用時必用優先。

## 12. 風險與注意事項

- 不要用隨機測試取代 oracle。fuzz 擅長抓非法結果，oracle 才能驗證最佳性。
- 不要讓 oracle 測試依賴 1 秒 UI time limit；oracle 應是測試用的完整搜尋。
- 不要把 benchmark 當成 pass/fail 的唯一依據；benchmark 只能觀察解品質、效能與 deterministic。
- 若 must-use 與填滿率衝突，先以 must-use score 判斷是否合理，再比較 filledCells。
- 若新增測試使 CI 過慢，優先縮小 oracle 枚舉範圍，保留 fuzz 和固定回歸案例。
