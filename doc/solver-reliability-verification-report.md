# 求解器可靠性驗證執行報告

執行日期：2026-06-16
依據文件：`doc/solver-reliability-verification-plan.md`

## 1. 前置檢查結果

| 檢查項目 | 狀態 |
|----------|------|
| `git status` working tree | clean |
| priority / 優先權程式碼殘留 | 無殘留 |
| `npm test` (原始) | 5 files, 50 tests passed |
| `npm run build` | success |
| `npm run benchmark:solver` (原始) | 5 cases, all deterministic |

## 2. 新增檔案

| 檔案 | 說明 |
|------|------|
| `src/solverTestUtils.ts` | `assertSolverResultIsLegal` 共用 helper：驗證 placement 合法性、不重疊、used/unused 一致性、must-use 語意等 |
| `src/solver.fuzz.test.ts` | 隨機 fuzz 測試：500 組 deterministic PRNG (seed=0x5eed) counts × 5 種棋盤，含 must-use 變體；100 組 determinism 檢查 |
| `src/solver.oracle.test.ts` | Exact oracle 比對：2 種小型棋盤 (3×3, 4×4) × 3 組道具集合，枚舉所有 count 組合，完整搜尋 oracle 驗證正式 solver 最佳性 |

## 3. 修改檔案

| 檔案 | 變更 |
|------|------|
| `README.md` | 新增 `npm run benchmark:solver` 指令；更新專案架構與求解語意說明；新增測試覆蓋四層驗證描述 |
| `src/solver.benchmark.ts` | 新增 3 組 dense inventory 案例 (exact fill, over-capacity, over-capacity with must-use) |

## 4. 各層驗證結果

### Layer 1 — 固定回歸案例

`solver.test.ts` 已包含全部 4 組必測案例：

| 案例 | 測試 | 狀態 |
|------|------|------|
| 剛好填滿 (P02:2, P05:2, P06:8, P07:7, P09:1) | `bestFilledCells=81`, `unusedCounts={}` | pass |
| 超量但可填滿 (P07:8 變體) | `bestFilledCells=81`, `selectedItemArea=85` | pass |
| P07 必用 (超量變體) | `mustUseSatisfied=true`, `bestFilledCells=81` | pass |
| 不可滿足必用 | `mustUseSatisfied=false`, solutions 非空 | pass |

### Layer 2 — Fuzz 不變量

- **500 組 counts** × **5 種棋盤** (full, default, 3 irregular) × **2 種 options** (無必用 + 隨機 must-use)
- 每組結果通過 `assertSolverResultIsLegal` 全量檢查
- 100 組 determinism 檢查：`provenOptimal=true` 案例連跑兩次 signature 一致

### Layer 3 — Exact Oracle

| 棋盤 | 道具集合 | 組合數 | 無必用 | 有必用 |
|------|---------|--------|--------|--------|
| 3×3 | small (P07,P08,P10,P11) | 35 | `bestFilledCells` 一致 | `bestFilledCells` + `mustUse` 一致 |
| 3×3 | medium (P05,P06,P07,P09) | 15 | `bestFilledCells` 一致 | `bestFilledCells` + `mustUse` 一致 |
| 3×3 | mixed (P02,P05,P06,P07,P09) | 31 | `bestFilledCells` 一致 | `bestFilledCells` + `mustUse` 一致 |
| 4×4 | small | 35 | `bestFilledCells` 一致 | `bestFilledCells` + `mustUse` 一致 |
| 4×4 | medium | 15 | `bestFilledCells` 一致 | `bestFilledCells` + `mustUse` 一致 |
| 4×4 | mixed | 31 | `bestFilledCells` 一致 | `bestFilledCells` + `mustUse` 一致 |

> 全部 12 組 oracle 測試通過，正式 solver 在小範圍內從未偏離全域最佳解。

### Layer 4 — Benchmark

8 組案例各跑 5 次，全部 deterministic：

| 案例 | bestFilledCells | utilization | provenOptimal | searchedNodes |
|------|-----------------|-------------|---------------|---------------|
| simple | 12 | 0.1481 | true | 218 |
| dense items | 15 | 1 | true | 94 |
| fragmented backpack | 45 | 0.75 | true | 68 |
| must-use pressure | 15 | 1 | true | 305 |
| over-capacity pressure | 15 | 1 | true | 25 |
| dense inventory exact fill | 81 | 1 | true | 1807 |
| dense inventory over-capacity | 81 | 1 | true | 1108 |
| dense inventory over-capacity + must-use | 81 | 1 | true | 468 |

### Layer 5 — UI Smoke

未執行（專案無 DOM testing 或 Playwright 設定，依計畫跳過）。

## 5. 最終驗證命令

```
npm test               : 7 files, 64 tests — all passed
npm run build          : tsc + vite build — success
npm run benchmark:solver : 1 file, 1 test, 8 cases × 5 runs — all deterministic
```

## 6. 完成標準對照

| 標準 | 達成 |
|------|------|
| 所有用戶回報案例有固定測試 | Yes (`solver.test.ts` L621-646) |
| Fuzz 測試至少 1000 組 deterministic cases | Yes (500 counts × 5 boards = 2500, +100 determinism) |
| Exact oracle 至少 2 種 board、2 組 item subset、含無必用與有必用 | Yes (2 boards × 3 subsets × 2 modes = 12 tests) |
| `npm test` 通過 | Yes (64 tests) |
| `npm run build` 通過 | Yes |
| `npm run benchmark:solver` 通過 | Yes (8 cases, all deterministic) |
| README 或 doc 有說明最佳化語意 | Yes (README.md L101) |
