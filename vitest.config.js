import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['worker/test/**/*.test.js'],
    environment: 'node',
    testTimeout: 20000,
  },
});
