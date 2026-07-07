import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/**/*.spec.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 2,
        maxForks: 4,
      },
    },
    server: {
      deps: {
        inline: ['@nestjs/common', '@nestjs/core', '@nestjs/testing'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
