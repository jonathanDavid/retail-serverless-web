/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite + Vitest configuration. Tests run in a jsdom-free `node` environment
// because every unit under test (money formatting, the order state machine,
// total computation) is pure logic — no DOM required.
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves under /retail-serverless-web/ in production.
  base: mode === 'production' ? '/retail-serverless-web/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/api/**'],
    },
  },
}));
