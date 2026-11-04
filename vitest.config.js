import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['worker/test/**/*.test.js', 'engine/test/**/*.test.js', 'frontend/test/**/*.test.js'],
    environment: 'node',
    testTimeout: 20000,
  },
});
