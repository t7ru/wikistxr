import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/demo',
  resolve: {
    alias: {
      wikistxr: resolve(__dirname, 'dist/esm')
    }
  },
  build: {
    outDir: '../../dist/demo'
  },
  server: {
    open: true
  }
});
