import { defineConfig } from 'vitest/config';
import content from './vite-plugin-content/index';

export default defineConfig({
  // относительные пути: сайт работает и с Pages (/hse-frs/), и с `npm run defense`
  base: './',
  plugins: [content()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
