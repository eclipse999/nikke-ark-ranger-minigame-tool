# NIKKE Ark Ranger Minigame Tool

[繁體中文](README.md) | English

A backpack optimization tool: a 9×9 inventory space planner for the Ark Ranger minigame in *Goddess of Victory: NIKKE*.

Enter the board's available cells, item quantities, and optional priority settings. The solver computes a strong placement within the time limit.

> This tool is inspired by and recreated from [nikke-mini-game.netlify.app](https://nikke-mini-game.netlify.app/), retaining its three-column UI while adding **item rotation** support.

## Online Version

Deployed on Cloudflare Pages:

- [English](https://nikke-ark-ranger-minigame-tool.pages.dev/?lang=en)
- [繁體中文](https://nikke-ark-ranger-minigame-tool.pages.dev/)

## Features

- **9×9 Board** — Click or drag across cells to mark unavailable cells (x) as available, with reset and fill-all shortcuts
- **P01–P14 Complete Items** — All 14 item types, auto-generating 0°/90°/180°/270° rotated shapes with deduplication
- **Item Priority 1–5** — Each item can be assigned a priority; higher numbers have higher weight and are preferred when space is tight
- **Must-use Items** — Mark selected items as must-use; when placements conflict, the solver prioritizes satisfying must-use items and reports whether they were all placed
- **Unplaced Item Summary** — Shows which items were placed and which could not fit, so trade-offs are easy to review
- **Backtracking Solver** — Uses a placement cache and pivot-cell DFS, with conservative pruning and a configurable time limit (default 1 second)
- **Best Placement View** — Shows the best placement for the current scoring order in the results panel
- **Bilingual UI** — Traditional Chinese / English, with `?lang=en` URL parameter for default language; switches instantly
- **Runs Locally** — Pure frontend, no backend required, data never leaves the browser

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open your browser at `http://localhost:5173`.

## Usage

1. **Set up the board** — Click or drag cells to mark them as available; or use "Fill All" / "Reset" buttons
2. **Enter quantities** — Fill in how many of each item you have in the center panel
3. **Set trade-offs** — Priority defaults to 1 and can be raised to 5; higher numbers have higher weight and are kept first when space is tight. Check "Must-use" to ask the solver to prefer keeping that item
4. **Run the solver** — Click "Optimize"; the solver finds the best placement it can within the time limit
5. **Review results** — The right panel shows usable cells, filled cells, item placement rate, inventory utilization, placed items, and unplaced items. Must-use status appears only when at least one item is marked must-use
6. **Switch language** — Use the language dropdown at the top right

## Commands

| Command           | Description                           |
|-------------------|---------------------------------------|
| `npm run dev`     | Start Vite dev server                 |
| `npm run build`   | Type-check + production build         |
| `npm run preview` | Preview production build              |
| `npm test`        | Run unit tests (Vitest)               |

## Tech Stack

- **Vite** — Bundler
- **React 19** — UI framework
- **TypeScript** — Type safety
- **Vitest** — Unit testing

## Project Structure

```
src/
├── types.ts           # Shared type definitions (Board, Shape, ItemDefinition, SolverResult)
├── board.ts           # Board creation, cloning, usable cell counting
├── items.ts           # P01–P14 item definitions and rotation shape generation
├── solver.ts          # Placement-cache + pivot-cell DFS solver (with time limit and pruning)
├── i18n.ts            # Traditional Chinese / English strings
├── App.tsx            # Main component: three-column UI, solver state management
├── main.tsx           # React entry point
└── styles.css         # Global styles
```

### Solver Strategy and Limits

- Before search, the solver builds a legal placement cache for the current board, excluding out-of-bounds placements and placements that cover unavailable cells
- It uses pivot-cell DFS: each step selects an unprocessed usable cell, tries legal placements covering that cell, and also keeps a skip branch for leaving that cell empty
- The best placement is ordered by must-use completion, priority weight, filled cells, unplaced item count, and a stable signature; the UI shows only the top result
- When selected item area is less than or equal to usable cells, the target filled cells equal the selected item area; when selected item area exceeds usable cells, the target filled cells equal usable cells
- The solver still has a time limit (UI default: 1 second). Extreme cases may return the best solution found within the time limit. Only when `provenOptimal` is `true` has the search completed and proven the best result for the current scoring order

## License

MIT
