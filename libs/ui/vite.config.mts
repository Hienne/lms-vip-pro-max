/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/ui',
  plugins: [angular()],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'ui',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'jsdom',
    // The first test that touches an icon pays for JIT-linking @lucide/angular's ~1,900 icon
    // components (about 15 s); later tests reuse the module.
    testTimeout: 60_000,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/ui',
      provider: 'v8' as const,
    },
  },
}));
