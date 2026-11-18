import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
    // type declarations come from tsc (npm run build), which avoids a plugin for one job
    emptyOutDir: true,
    // lit stays a dependency of the host, so a page using other Lit elements loads it once
    rollupOptions: { external: [/^lit/, /^@lit\//] },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
