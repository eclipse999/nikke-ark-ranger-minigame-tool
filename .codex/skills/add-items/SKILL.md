---
name: add-items
description: Add newly provided item shape data to the NIKKE Ark Ranger minigame packing tool. Use when Codex is asked to add, update, extend, or validate item definitions for this project, especially when the user provides grid-based item shapes using X and . rows and expects src/items.ts, item tests, and shape rotation behavior to stay correct.
---

# Add Items

## Workflow

Use this skill to add provided item shapes to the NIKKE Ark Ranger minigame tool without inventing missing data.

1. Inspect the current repository before editing.
   - 中文註釋：先確認目前是否是 `nikke-ark-ranger-minigame-tool`，並讀取 `src/items.ts`、`src/items.test.ts`、`src/types.ts`、`items-plan.md`（若存在）。
   - Prefer `rg` and direct file reads.

2. Parse only user-provided item data.
   - 中文註釋：只加入使用者明確提供的道具；不要自行推測名稱、形狀、數量或缺漏道具。
   - Accept item IDs such as `P16` or concise codes already supplied by the user.
   - Treat `X` as occupied and `.` as empty.
   - Preserve row order exactly as supplied.

3. Update item definitions.
   - 中文註釋：通常只需要更新 `src/items.ts` 的 `itemBaseShapes`；專案已用 `createRotations` 自動產生 0/90/180/270 度並去除重複旋轉。
   - Keep the existing shape format: `{ id: 'P16', baseShape: ['XX.', '.XX'] }`.
   - Keep item IDs sorted naturally when the existing file uses sorted IDs.
   - Do not hard-code item quantities; quantities belong in UI state/user input.

4. Update tests when item IDs change.
   - 中文註釋：若新增或移除道具，更新 `src/items.test.ts` 中檢查 ID 清單的測試名稱與預期值。
   - Add focused tests only when the new data introduces a risky shape case, such as an empty-looking row, unusual width, symmetry, or a shape that should deduplicate rotations.

5. Validate.
   - 中文註釋：至少執行 `npm test`；若 UI 或 build surface 受到影響，也執行 `npm run build`。
   - If dependencies are missing, inspect `package.json` and explain the blocker instead of rewriting tooling.

## Project Reference

For this repository's conventions, read `references/nikke-item-rules.md` before making edits.

