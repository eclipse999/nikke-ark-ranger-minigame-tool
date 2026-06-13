# NIKKE Ark Ranger Minigame Tool

[繁體中文](README.md) | English

A backpack optimization tool: a 9×9 inventory space planner for the Ark Ranger minigame in *Goddess of Victory: NIKKE*.

Enter the board's available cells and item quantities, and the solver automatically computes the highest-utilization placement.

> This tool is inspired by and recreated from [nikke-mini-game.netlify.app](https://nikke-mini-game.netlify.app/), retaining its three-column UI while adding **item rotation** support.

## Online Version

Deployed on Netlify:

- [English](https://nikke-ark-ranger-minigame-tool.netlify.app/?lang=en)
- [繁體中文](https://nikke-ark-ranger-minigame-tool.netlify.app/)

## Features

- **9×9 Board** — Click or drag across cells to mark unavailable cells (x) as available, with reset and fill-all shortcuts
- **P01–P15 Complete Items** — All 15 item types, auto-generating 0°/90°/180°/270° rotated shapes with deduplication
- **Backtracking Solver** — Prioritizes large items first, with area pruning and a configurable time limit (default 1 second)
- **Multiple Solutions** — Retains up to 3 best solutions, switchable in the results panel
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
3. **Run the solver** — Click "Optimize"; the solver finds the best placement within 1 second
4. **Review results** — The right panel shows available cells, filled cells, and utilization rate. Items are color-coded on the board; use arrow buttons to switch between candidate solutions
5. **Switch language** — Use the language dropdown at the top right

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
├── items.ts           # P01–P15 item definitions and rotation shape generation
├── solver.ts          # Backtracking solver (with time limit and area pruning)
├── i18n.ts            # Traditional Chinese / English strings
├── App.tsx            # Main component: three-column UI, solver state management
├── main.tsx           # React entry point
└── styles.css         # Global styles
```

### Solver Strategy

- Backtracking search + greedy heuristic: prioritizes items with larger area
- Tries all deduplicated rotated shapes for each item, scanning left-to-right, top-to-bottom
- Area pruning: if remaining free cells are fewer than the smallest remaining item, backtracks early
- 1-second time limit: on timeout, returns the best solution found so far, marked "time-limited best"

## License

MIT
