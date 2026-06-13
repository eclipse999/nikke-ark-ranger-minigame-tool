import { useMemo, useRef, useState } from 'react';
import { cloneBoard, countUsableCells, createDefaultBoard, createFullBoard } from './board';
import { messages, type Locale } from './i18n';
import { getItemColor } from './itemColors';
import { items } from './items';
import { importScreenshotImage, readImageFile } from './screenshotImport';
import { solveInventory } from './solver';
import type { Board, Placement, SolverResult } from './types';

function ShapePreview({ cells, width, height }: { cells: { row: number; col: number }[]; width: number; height: number }) {
  const filled = new Set(cells.map((cell) => `${cell.row},${cell.col}`));

  return (
    <div
      className="shape-preview"
      style={{
        gridTemplateColumns: `repeat(${width}, 12px)`,
        gridTemplateRows: `repeat(${height}, 12px)`,
      }}
    >
      {Array.from({ length: width * height }, (_, index) => {
        const row = Math.floor(index / width);
        const col = index % width;
        return <span key={`${row}-${col}`} className={filled.has(`${row},${col}`) ? 'shape-cell filled' : 'shape-cell'} />;
      })}
    </div>
  );
}

function BoardGrid({
  board,
  placements,
  onToggle,
  labels,
}: {
  board: Board;
  placements?: Placement[];
  onToggle?: (row: number, col: number) => void;
  labels: { available: string; unavailable: string; occupied: string };
}) {
  const occupied = useMemo(() => {
    const map = new Map<string, { placement: Placement; color: string; edgeClassName: string; instanceClassName: string }>();
    const copyIndexes = new Map<string, number>();

    placements?.forEach((placement) => {
      const copyIndex = copyIndexes.get(placement.itemId) ?? 0;
      copyIndexes.set(placement.itemId, copyIndex + 1);

      const placementCells = new Set(placement.cells.map((cell) => `${cell.row},${cell.col}`));
      const instanceClassName = `item-instance-${copyIndex % 4}`;

      placement.cells.forEach((cell) => {
        const edgeClassName = [
          placementCells.has(`${cell.row - 1},${cell.col}`) ? '' : 'piece-edge-top',
          placementCells.has(`${cell.row},${cell.col + 1}`) ? '' : 'piece-edge-right',
          placementCells.has(`${cell.row + 1},${cell.col}`) ? '' : 'piece-edge-bottom',
          placementCells.has(`${cell.row},${cell.col - 1}`) ? '' : 'piece-edge-left',
        ]
          .filter(Boolean)
          .join(' ');

        map.set(`${cell.row},${cell.col}`, {
          placement,
          color: getItemColor(placement.itemId),
          edgeClassName,
          instanceClassName,
        });
      });
    });
    return map;
  }, [placements]);

  return (
    <div className="board-grid">
      {board.flatMap((rowCells, row) =>
        rowCells.map((available, col) => {
          const placed = occupied.get(`${row},${col}`);
          const title = placed ? `${placed.placement.itemId} ${labels.occupied}` : available ? labels.available : labels.unavailable;

          return (
            <button
              key={`${row}-${col}`}
              className={`board-cell ${available ? 'available' : 'blocked'} ${placed ? `placed ${placed.edgeClassName} ${placed.instanceClassName}` : ''}`}
              onClick={() => onToggle?.(row, col)}
              style={placed ? { backgroundColor: placed.color } : undefined}
              type="button"
              title={title}
              disabled={!onToggle}
              aria-label={`${row + 1}-${col + 1} ${title}`}
            >
              {placed ? placed.placement.itemId.slice(1) : available ? '' : 'x'}
            </button>
          );
        }),
      )}
    </div>
  );
}

function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const language = new URLSearchParams(window.location.search).get('lang');
    return language === 'en' ? 'en' : 'zh-Hant';
  });
  const [board, setBoard] = useState<Board>(() => createDefaultBoard());
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, 0])));
  const [result, setResult] = useState<SolverResult | null>(null);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [hasImportError, setHasImportError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const t = messages[locale];

  const usableCells = useMemo(() => countUsableCells(board), [board]);
  const currentSolution = result?.solutions[solutionIndex] ?? null;

  function updateCount(itemId: string, value: string) {
    const nextValue = Math.max(0, Math.floor(Number(value) || 0));
    setCounts((current) => ({ ...current, [itemId]: nextValue }));
    setResult(null);
    setSolutionIndex(0);
    setHasImportError(false);
  }

  function toggleCell(row: number, col: number) {
    setBoard((current) => {
      const next = cloneBoard(current);
      next[row][col] = !next[row][col];
      return next;
    });
    setResult(null);
    setSolutionIndex(0);
    setHasImportError(false);
  }

  function runSolver() {
    const nextResult = solveInventory(board, counts, { maxSolutions: 3, timeLimitMs: 1000 });
    setResult(nextResult);
    setSolutionIndex(0);
  }

  function resetBoard() {
    setBoard(createDefaultBoard());
    setResult(null);
    setSolutionIndex(0);
    setHasImportError(false);
  }

  function makeFullBoard() {
    setBoard(createFullBoard());
    setResult(null);
    setSolutionIndex(0);
    setHasImportError(false);
  }

  function clearItems() {
    setCounts(Object.fromEntries(items.map((item) => [item.id, 0])));
    setResult(null);
    setSolutionIndex(0);
    setHasImportError(false);
  }

  async function importScreenshot(file: File) {
    setIsImporting(true);
    setHasImportError(false);

    try {
      const imageData = await readImageFile(file);
      const imported = importScreenshotImage(imageData);

      setBoard(imported.board);
      setResult(null);
      setSolutionIndex(0);
    } catch {
      setHasImportError(true);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>{t.appTitle}</h1>
          <p>{t.appDescription}</p>
        </div>
        <label className="language-control">
          <span>Language</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="zh-Hant">繁體中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>

      <section className="workspace">
        <section className="panel board-panel">
          <div className="panel-heading">
            <h2>{t.board}</h2>
            <div className="board-heading-actions">
              <label className={`file-button compact-button ${isImporting ? 'disabled' : ''}`}>
                {isImporting ? t.importingScreenshot : t.importScreenshot}
                <input
                  ref={fileInputRef}
                  accept="image/*"
                  disabled={isImporting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void importScreenshot(file);
                    }
                  }}
                  type="file"
                />
              </label>
              <span>{usableCells}/81</span>
            </div>
          </div>
          <p className="import-hint">{t.importScreenshotHint}</p>

          <BoardGrid
            board={board}
            onToggle={toggleCell}
            labels={{ available: t.available, unavailable: t.unavailable, occupied: t.occupied }}
          />
          <div className="button-row">
            <button type="button" onClick={resetBoard}>
              {t.resetBoard}
            </button>
            <button type="button" onClick={makeFullBoard}>
              {t.fullBoard}
            </button>
          </div>
          {hasImportError ? <p className="import-status">{t.importFailed}</p> : null}
        </section>

        <section className="panel item-panel">
          <div className="panel-heading">
            <h2>{t.items}</h2>
            <div className="panel-actions">
              <button className="primary-button compact-button" type="button" onClick={clearItems}>
                {t.clearItems}
              </button>
              <button className="primary-button compact-button" type="button" onClick={runSolver}>
                {t.solve}
              </button>
            </div>
          </div>
          <div className="item-list">
            {items.map((item) => (
              <article className="item-row" key={item.id}>
                <div className="item-main">
                  <strong>{item.id}</strong>
                  <ShapePreview cells={item.rotations[0].cells} width={item.rotations[0].width} height={item.rotations[0].height} />
                </div>
                <label>
                  <span className="sr-only">{t.quantity}</span>
                  <input
                    min="0"
                    inputMode="numeric"
                    type="number"
                    value={counts[item.id] ?? 0}
                    onChange={(event) => updateCount(item.id, event.target.value)}
                  />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="panel result-panel">
          <div className="panel-heading">
            <h2>{t.results}</h2>
          </div>

          {result && currentSolution ? (
            <>
              <div className="stats">
                <div>
                  <span>{t.usableCells}</span>
                  <strong>{result.usableCells}</strong>
                </div>
                <div>
                  <span>{t.filledCells}</span>
                  <strong>{result.bestFilledCells}</strong>
                </div>
                <div>
                  <span>{t.utilization}</span>
                  <strong>{Math.round(result.utilization * 1000) / 10}%</strong>
                </div>
              </div>
              <BoardGrid
                board={board}
                placements={currentSolution.placements}
                labels={{ available: t.available, unavailable: t.unavailable, occupied: t.occupied }}
              />
              <div className="solution-controls">
                <button
                  type="button"
                  disabled={solutionIndex === 0}
                  onClick={() => setSolutionIndex((index) => Math.max(0, index - 1))}
                >
                  {t.previous}
                </button>
                <span>
                  {t.solution} {solutionIndex + 1}/{result.solutions.length}
                </span>
                <button
                  type="button"
                  disabled={solutionIndex >= result.solutions.length - 1}
                  onClick={() => setSolutionIndex((index) => Math.min(result.solutions.length - 1, index + 1))}
                >
                  {t.next}
                </button>
              </div>
            </>
          ) : (
            <p className="empty-state">{t.noResult}</p>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
