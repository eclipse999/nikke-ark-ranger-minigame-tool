import { useMemo, useRef, useState } from 'react';
import { backpackPresets, type BackpackPresetId } from './backpackPresets';
import { cloneBoard, countUsableCells, createDefaultBoard, createFullBoard } from './board';
import { messages, type Locale } from './i18n';
import { getItemColor } from './itemColors';
import { items } from './items';
import { solveInventory } from './solver';
import type { Board, Placement, SolverResult } from './types';

function ShapePreview({ cells, width, height }: { cells: { row: number; col: number }[]; width: number; height: number }) {
  const filled = new Set(cells.map((cell) => `${cell.row},${cell.col}`));

  return (
    <div
      className="shape-preview"
      style={{
        gridTemplateColumns: `repeat(${width}, 10px)`,
        gridTemplateRows: `repeat(${height}, 10px)`,
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
  onBulkOpen,
  labels,
}: {
  board: Board;
  placements?: Placement[];
  onToggle?: (row: number, col: number) => void;
  onBulkOpen?: (cells: { row: number; col: number }[]) => void;
  labels: { available: string; unavailable: string; occupied: string; toggleAvailability?: string };
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

  const [selection, setSelection] = useState<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(null);
  const selectionRef = useRef<typeof selection>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  function getCellFromEvent(event: React.PointerEvent<HTMLDivElement>): { row: number; col: number } | null {
    const pointerTarget = document.elementFromPoint(event.clientX, event.clientY);
    const target = pointerTarget instanceof HTMLElement && event.currentTarget.contains(pointerTarget) ? pointerTarget : (event.target as HTMLElement);
    const cell = target.closest('[data-cell]') as HTMLElement | null;
    if (!cell) return null;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { row, col };
  }

  function setActiveSelection(nextSelection: typeof selection) {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }

  function capturePointer(element: HTMLDivElement, pointerId: number) {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Synthetic pointer events used by tests may not have an active pointer.
    }
  }

  function releasePointer(element: HTMLDivElement, pointerId: number) {
    try {
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore non-active synthetic pointer ids.
    }
  }

  function commitSelection(start: { row: number; col: number }, end: { row: number; col: number }) {
    if (!onBulkOpen) return;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const cells: { row: number; col: number }[] = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        cells.push({ row, col });
      }
    }
    onBulkOpen(cells);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!onToggle || !onBulkOpen) return;
    event.preventDefault();
    const cell = getCellFromEvent(event);
    if (!cell) return;
    capturePointer(event.currentTarget, event.pointerId);
    setActiveSelection({ start: cell, end: cell });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!selectionRef.current) return;
    event.preventDefault();
    const cell = getCellFromEvent(event);
    if (!cell) return;
    setSelection((current) => {
      if (!current || (current.end.row === cell.row && current.end.col === cell.col)) return current;
      const nextSelection = { ...current, end: cell };
      selectionRef.current = nextSelection;
      return nextSelection;
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const activeSelection = selectionRef.current;
    if (!activeSelection) return;
    event.preventDefault();
    releasePointer(event.currentTarget, event.pointerId);
    const { start, end } = activeSelection;
    setActiveSelection(null);
    if (start.row === end.row && start.col === end.col) {
      onToggle?.(start.row, start.col);
    } else {
      commitSelection(start, end);
    }
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    const activeSelection = selectionRef.current;
    if (!activeSelection || event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const { start, end } = activeSelection;
    setActiveSelection(null);
    if (start.row === end.row && start.col === end.col) {
      return;
    }
    commitSelection(start, end);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (!selectionRef.current) return;
    releasePointer(event.currentTarget, event.pointerId);
    setActiveSelection(null);
  }

  const selectionBounds = useMemo(() => {
    if (!selection) return null;
    return {
      minRow: Math.min(selection.start.row, selection.end.row),
      maxRow: Math.max(selection.start.row, selection.end.row),
      minCol: Math.min(selection.start.col, selection.end.col),
      maxCol: Math.max(selection.start.col, selection.end.col),
    };
  }, [selection]);

  return (
    <div
      ref={gridRef}
      className="board-grid"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'none' }}
    >
      {board.flatMap((rowCells, row) =>
        rowCells.map((available, col) => {
          const placed = occupied.get(`${row},${col}`);
          const stateTitle = placed ? `${placed.placement.itemId} ${labels.occupied}` : available ? labels.available : labels.unavailable;
          const title = onToggle && !placed && labels.toggleAvailability ? `${stateTitle} - ${labels.toggleAvailability}` : stateTitle;
          const inSelection = selectionBounds && row >= selectionBounds.minRow && row <= selectionBounds.maxRow && col >= selectionBounds.minCol && col <= selectionBounds.maxCol;

          return (
            <div
              key={`${row}-${col}`}
              data-cell
              data-row={row}
              data-col={col}
              className={`board-cell ${available ? 'available' : 'blocked'} ${placed ? `placed ${placed.edgeClassName} ${placed.instanceClassName}` : ''} ${inSelection ? 'selecting' : ''}`}
              role="button"
              tabIndex={onToggle ? 0 : -1}
              title={title}
              aria-label={`${row + 1}-${col + 1} ${title}`}
              style={placed ? { backgroundColor: placed.color } : undefined}
            >
              {placed ? placed.placement.itemId.slice(1) : available ? '' : 'x'}
            </div>
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
  const [backpackPresetId, setBackpackPresetId] = useState<BackpackPresetId>('character-1');
  const [board, setBoard] = useState<Board>(() => createDefaultBoard('character-1'));
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, 0])));
  const [countInputs, setCountInputs] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, '0'])));
  const [mustUseItemIds, setMustUseItemIds] = useState<string[]>([]);
  const [result, setResult] = useState<SolverResult | null>(null);
  const t = messages[locale];
  const usableCells = useMemo(() => countUsableCells(board), [board]);
  const totalCells = board.length * (board[0]?.length ?? 0);
  const currentSolution = result?.solutions[0] ?? null;
  const mustUseSet = useMemo(() => new Set(mustUseItemIds), [mustUseItemIds]);
  const hasMustUseItems = mustUseItemIds.length > 0;
  const resultStatus = useMemo(() => {
    if (!result) return null;
    const ratio = result.selectedPlacementRatio;
    if (ratio >= 1) return { key: 'complete', label: t.resultStatus.complete };
    if (ratio >= 0.9) return { key: 'good', label: t.resultStatus.good };
    if (ratio >= 0.5) return { key: 'notice', label: t.resultStatus.notice };
    return { key: 'needs-adjustment', label: t.resultStatus.needsAdjustment };
  }, [result, t.resultStatus]);

  const usedCounts = useMemo(() => {
    const map = new Map<string, number>();
    currentSolution?.placements.forEach((placement) => {
      map.set(placement.itemId, (map.get(placement.itemId) ?? 0) + 1);
    });
    return map;
  }, [currentSolution]);

  function updateCount(itemId: string, value: string) {
    const digits = value.replace(/\D/g, '');
    const displayValue = digits === '' ? '' : digits.replace(/^0+(?=\d)/, '');
    const nextValue = displayValue === '' ? 0 : Math.max(0, Math.floor(Number(displayValue) || 0));
    setCountInputs((current) => ({ ...current, [itemId]: displayValue }));
    setCounts((current) => ({ ...current, [itemId]: nextValue }));
    if (nextValue === 0) {
      setMustUseItemIds((current) => current.filter((currentItemId) => currentItemId !== itemId));
    }
    setResult(null);
  }

  function toggleMustUse(itemId: string, checked: boolean) {
    setMustUseItemIds((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((currentItemId) => currentItemId !== itemId);
    });
    setResult(null);
  }

  function toggleCell(row: number, col: number) {
    setBoard((current) => {
      const next = cloneBoard(current);
      next[row][col] = !next[row][col];
      return next;
    });
    setResult(null);
  }

  function bulkOpenCells(cells: { row: number; col: number }[]) {
    setBoard((current) => {
      const next = cloneBoard(current);
      let changed = false;
      for (const { row, col } of cells) {
        if (!next[row]?.[col]) {
          next[row][col] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setResult(null);
  }

  function runSolver() {
    const nextResult = solveInventory(board, counts, { maxSolutions: 1, timeLimitMs: 1000, mustUseItemIds });
    setResult(nextResult);
  }

  function updateBackpackPreset(value: BackpackPresetId) {
    const preset = backpackPresets.find((entry) => entry.id === value);
    if (!preset?.enabled) return;
    setBackpackPresetId(value);
    setBoard(createDefaultBoard(value));
    setResult(null);
  }

  function resetBoard() {
    setBoard(createDefaultBoard(backpackPresetId));
    setResult(null);
  }

  function makeFullBoard() {
    setBoard(createFullBoard());
    setResult(null);
  }

  function clearItems() {
    setCounts(Object.fromEntries(items.map((item) => [item.id, 0])));
    setCountInputs(Object.fromEntries(items.map((item) => [item.id, '0'])));
    setMustUseItemIds([]);
    setResult(null);
  }

  function clearMustUse() {
    setMustUseItemIds([]);
    setResult(null);
  }


  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>{t.appTitle}</h1>
          <p>{t.appDescription}</p>
        </div>
      </header>

      <div className="workspace-tools">
        <div className="topbar-tools">
          <a className="github-link" href="https://github.com/eclipse999/nikke-ark-ranger-minigame-tool" target="_blank" rel="noopener noreferrer">
            {t.github}
          </a>
          <label className="language-control" aria-label={t.language}>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="zh-Hant">繁體中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </div>

      <section className="workspace">
        <section className="panel board-panel">
          <div className="panel-heading">
            <h2>{t.board}</h2>
            <div className="board-heading-actions">
              <span>{usableCells}/{totalCells}</span>
            </div>
          </div>
          <label className="backpack-preset-control">
            <span>{t.backpackPreset}</span>
            <select value={backpackPresetId} onChange={(event) => updateBackpackPreset(event.target.value as BackpackPresetId)}>
              {backpackPresets.map((preset) => (
                <option key={preset.id} value={preset.id} disabled={!preset.enabled}>
                  {t.backpackPresetLabels[preset.id]}
                </option>
              ))}
            </select>
          </label>

          <BoardGrid
            board={board}
            onToggle={toggleCell}
            onBulkOpen={bulkOpenCells}
            labels={{ available: t.available, unavailable: t.unavailable, occupied: t.occupied, toggleAvailability: t.toggleAvailability }}
          />
          <div className="button-row">
            <button type="button" onClick={makeFullBoard}>
              {t.fullBoard}
            </button>
            <button type="button" onClick={resetBoard}>
              {t.resetBoard}
            </button>
          </div>
        </section>

        <section className="panel item-panel">
          <div className="panel-heading">
            <h2>{t.items}</h2>
          </div>
          <div className="panel-actions">
            <div className="secondary-actions">
              <button className="secondary-button compact-button" type="button" onClick={clearItems}>
                {t.clearItems}
              </button>
              <button className="secondary-button compact-button" type="button" onClick={clearMustUse} disabled={!hasMustUseItems}>
                {t.clearMustUse}
              </button>
            </div>
            <button className="primary-button compact-button" type="button" onClick={runSolver}>
              {t.solve}
            </button>
          </div>
          <div className="item-list">
            {items.map((item) => (
              <article className="item-row" key={item.id}>
                <div className="item-top">
                  <div className="item-main">
                    <strong>{item.id}</strong>
                    <ShapePreview cells={item.rotations[0].cells} width={item.rotations[0].width} height={item.rotations[0].height} />
                  </div>
                  <label className="quantity-control">
                    <span>{t.quantity}</span>
                    <input
                      min="0"
                      inputMode="numeric"
                      type="number"
                      value={countInputs[item.id] ?? String(counts[item.id] ?? 0)}
                      onChange={(event) => updateCount(item.id, event.target.value)}
                    />
                  </label>
                  <label className="must-use-control">
                    <input
                      type="checkbox"
                      checked={mustUseSet.has(item.id)}
                      disabled={(counts[item.id] ?? 0) === 0}
                      onChange={(event) => toggleMustUse(item.id, event.target.checked)}
                    />
                    <span>{t.mustUse}</span>
                  </label>
                </div>
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
                <div className={resultStatus ? `status-stat ${resultStatus.key}` : undefined}>
                  <span>{t.placementRatio}</span>
                  <strong>{Math.round(result.selectedPlacementRatio * 1000) / 10}%</strong>
                  {resultStatus && <em>{resultStatus.label}</em>}
                </div>
                <div>
                  <span>{t.utilization}</span>
                  <strong>{Math.round(result.utilization * 1000) / 10}%</strong>
                </div>
              </div>
              {hasMustUseItems && (
                <div className={`result-alert ${result.mustUseSatisfied ? 'satisfied' : 'warning'}`}>
                  <strong>{result.mustUseSatisfied ? t.mustUseSatisfied : t.mustUseMissing}</strong>
                  {!result.mustUseSatisfied && (
                    <span>
                      {Object.entries(result.mustUseUnusedCounts)
                        .map(([itemId, count]) => `${itemId} x${count}`)
                        .join(', ')}
                    </span>
                  )}
                </div>
              )}
              <BoardGrid
                board={board}
                placements={currentSolution.placements}
                labels={{ available: t.available, unavailable: t.unavailable, occupied: t.occupied }}
              />
              <div className="usage-summary">
                <h3>{t.usedItems}</h3>
                <div className="usage-list">
                  {items.map((item) => {
                    const used = usedCounts.get(item.id) ?? 0;
                    if (used === 0) return null;
                    const shape = item.rotations[0];
                    return (
                      <div key={item.id} className="usage-card">
                        <ShapePreview cells={shape.cells} width={shape.width} height={shape.height} />
                        <div className="usage-card-body">
                          <strong>{item.id}</strong>
                          <span>×{used}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={Object.keys(result.unusedCounts).length > 0 ? 'usage-summary unused-warning' : 'usage-summary'}>
                <h3>{t.unusedItems}</h3>
                {Object.keys(result.unusedCounts).length > 0 ? (
                  <div className="usage-list">
                    {items.map((item) => {
                      const unused = result.unusedCounts[item.id] ?? 0;
                      if (unused === 0) return null;
                      const shape = item.rotations[0];
                      return (
                        <div key={item.id} className="usage-card unused-card">
                          <ShapePreview cells={shape.cells} width={shape.width} height={shape.height} />
                          <div className="usage-card-body">
                            <strong>{item.id}</strong>
                            <span>×{unused}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-mini">{t.noUnusedItems}</p>
                )}
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
