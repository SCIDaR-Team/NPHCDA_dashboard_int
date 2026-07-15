import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Vitest runs the pure calc-engine unit tests (Node environment — no DOM needed).
// The `@` alias mirrors vite.config.ts so test imports resolve identically.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
