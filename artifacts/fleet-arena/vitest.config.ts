import { defineConfig } from 'vitest/config';

/**
 * Vitest is scoped to the pure game engine only. The engine has ZERO
 * react-native imports so it runs in a plain Node environment.
 */
export default defineConfig({
  test: {
    include: ['lib/engine/**/*.test.ts'],
    environment: 'node',
  },
});
