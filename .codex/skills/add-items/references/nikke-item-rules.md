# NIKKE Ark Ranger Item Rules

## Repository Shape

- Item definitions live in `src/items.ts`.
- Item tests live in `src/items.test.ts`.
- Shared shape types live in `src/types.ts`.
- `items-plan.md` may contain the original user-supplied item list and constraints.

## Data Format

Use this format in `itemBaseShapes`:

```ts
{ id: 'P16', baseShape: ['XX.', '.XX'] }
```

中文註釋：
- `id` 使用使用者提供的代號，不要自行命名。
- `baseShape` 的每個字串是一列。
- `X` 代表佔用格，`.` 代表空格。
- 保留使用者提供的列順序與形狀，不要為了美觀重排。

## Rotation Behavior

`createRotations(baseShape)` already:

- Parses occupied cells from `X`.
- Produces 0, 90, 180, and 270 degree rotations.
- Normalizes rotated cells back to the top-left.
- Removes duplicate rotations for symmetric shapes.
- Tracks width, height, area, and rotation.

中文註釋：
- 新增道具時通常不需要改旋轉邏輯。
- 只有在規則改變（例如某些道具不可旋轉）時，才考慮修改 `createRotations` 或型別。

## Test Expectations

When adding item IDs:

- Update the ID list test in `src/items.test.ts`.
- Keep the expected list explicit so accidental additions/removals are caught.
- Run `npm test`.

中文註釋：
- 若測試名稱仍寫著 `P01 through P15 only`，新增 P16 後要同步改名，例如 `defines the provided item IDs`。
- 若新增特殊形狀，補一個針對尺寸、面積或旋轉去重的測試。

## Guardrails

- Do not invent unprovided items.
- Do not hard-code item counts.
- Do not add screenshot recognition unless explicitly requested.
- Do not change board size unless explicitly requested.
- Keep edits scoped to item data, nearby tests, and necessary type changes.

