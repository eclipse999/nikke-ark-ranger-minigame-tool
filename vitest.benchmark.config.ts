import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/solver.benchmark.ts'],
  },
});
