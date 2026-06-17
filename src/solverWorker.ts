import { solveInventory } from './solver';
import type { Board, SolverOptions, SolverResult } from './types';

export type SolverWorkerRequest = {
  requestId: number;
  board: Board;
  counts: Record<string, number>;
  options: SolverOptions;
};

export type SolverWorkerResponse = {
  requestId: number;
  result: SolverResult;
};

self.onmessage = (event: MessageEvent<SolverWorkerRequest>) => {
  const { requestId, board, counts, options } = event.data;
  const result = solveInventory(board, counts, options);
  const response: SolverWorkerResponse = { requestId, result };

  self.postMessage(response);
};
