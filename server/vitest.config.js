import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Runs before test files are imported, so config/db pick up these env vars.
    setupFiles: ['./test/setup.js'],
  },
});
