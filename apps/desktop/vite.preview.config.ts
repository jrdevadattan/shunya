// Browser-only design preview of the renderer with mocked Electron bridges.
// Run: pnpm --filter @recovery/desktop exec vite --config vite.preview.config.ts
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'preview',
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { esbuildOptions: { jsx: 'automatic' } },
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5180, strictPort: true, host: '127.0.0.1', fs: { allow: [path.resolve(__dirname, '../..')] } },
});
