import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // The integration suite shares one test database, so run files serially.
    fileParallelism: false,
    // Neon cold starts plus a full reseed can be slow; the sale/return tests
    // also run deliberate concurrency checks. These are generous but still
    // bounded, so a genuinely hung test fails instead of hanging the run.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    teardownTimeout: 30_000,
  },
});
