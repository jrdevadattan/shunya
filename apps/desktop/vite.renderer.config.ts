import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  build: { outDir: path.resolve(__dirname, '.vite/renderer/main_window') },
});
