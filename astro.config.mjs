import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  srcDir: './src/frontend',
  outDir: './dist/frontend',
  publicDir: './src/frontend/public',
  integrations: [preact()],
  server: {
    port: 3000
  }
});