import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      react: path.resolve('../..', 'node_modules/react'),
      'react-dom': path.resolve('../..', 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
