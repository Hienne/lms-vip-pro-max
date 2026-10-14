/// <reference types='vitest' />
import { join } from 'node:path';
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/lms',
  plugins: [angular()],
  resolve: { tsconfigPaths: true },
  // `@use 'ui';` resolves through this include path, as in the app build (project.json).
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [join(import.meta.dirname, '../../libs/ui/src/styles')],
      },
    },
  },
  test: {
    name: 'lms',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // The first test that touches an icon pays for JIT-linking @lucide/angular's ~1,900 icon
    // components (about 15 s); later tests reuse the module.
    testTimeout: 120_000,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/lms',
      provider: 'v8' as const,
    },
  },
}));
