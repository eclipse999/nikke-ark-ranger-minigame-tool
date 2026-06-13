export type Cell = {
  row: number;
  col: number;
};

export type Rotation = 0 | 90 | 180 | 270;

export type Shape = {
  cells: Cell[];
  width: number;
  height: number;
  area: number;
  rotation: Rotation;
};

export type ItemDefinition = {
  id: string;
  baseShape: string[];
  rotations: Shape[];
};

export type Board = boolean[][];

export type Placement = {
  itemId: string;
  rotation: Rotation;
  row: number;
  col: number;
  cells: Cell[];
};

export type CandidateSolution = {
  placements: Placement[];
  filledCells: number;
};

export type SolverStopReason = 'complete' | 'time-limit';

export type SolverOptions = {
  maxSolutions?: number;
  timeLimitMs?: number;
  priorityByItemId?: Record<string, number>;
  mustUseItemIds?: string[];
};

export type SolverResult = {
  bestFilledCells: number;
  usableCells: number;
  utilization: number;
  solutions: CandidateSolution[];
  selectedItemArea: number;
  placedItemArea: number;
  selectedPlacementRatio: number;
  usedCounts: Record<string, number>;
  unusedCounts: Record<string, number>;
  priorityScore: number;
  mustUseSatisfied: boolean;
  mustUseUsedCounts: Record<string, number>;
  mustUseUnusedCounts: Record<string, number>;
  targetFilledCells: number;
  provenOptimal: boolean;
  stopReason: SolverStopReason;
  searchedNodes: number;
};
