import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      reporter: [['text', { maxCols: process.stdout.columns ?? 200 }], 'clover', 'html', 'cobertura'],
      include: ['src/**/*.{ts,mjs,cjs,mts,cts}'],
      reportsDirectory: './build/brazil-documentation/coverage/',
    },
    reporters: ['verbose'], // Displays each individual test after the suite has finished
    outputFile: 'build/brazil-unit-tests/TESTS-TestSuites.xml',
  },
});
