import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: [/svelte/, /@testing-library\/svelte/]
      }
    }
  }
});
