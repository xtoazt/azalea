import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'package/index.ts'),
      name: 'ClayBackend',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'clay-util.esm.js' : 'clay-util.js'
    },
    rollupOptions: {
      // No external dependencies - package is self-contained backend
      external: [],
      output: {
        globals: {}
      }
    },
    outDir: 'dist',
    sourcemap: true
  }
});

