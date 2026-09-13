import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import { gameplayTracing } from './tools/trace-instrumentation';

export default defineConfig({
  plugins: [gameplayTracing()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**'],
    setupFiles: ['./src/lib/test-game-definition.ts'],
  },
});
