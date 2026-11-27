import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'GoogleAIHubContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
