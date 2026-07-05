import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // vitest bundles its own Vite types — cast plugins to reconcile type mismatch
  plugins: [tailwindcss() as unknown as Plugin, sveltekit() as unknown as Plugin],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
      '$lib/*': path.resolve('./src/lib/*'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
  },
});
