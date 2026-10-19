import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/natural-soak.ts'],
    testTimeout: 360_000,
    hookTimeout: 60_000,
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
  },
});
