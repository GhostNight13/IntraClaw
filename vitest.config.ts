import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'src/queue/**'],
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 10_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts',
        'src/queue/**', 'data/**', '.planning/**', 'memory/**',
      ],
    },
  },
});
