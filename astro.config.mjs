import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  srcDir: './src/frontend',
  outDir: './dist/frontend',
  publicDir: './src/frontend/public',
  base: '',
  build: {
    assetsPrefix: './'
  },
  integrations: [preact()],
  server: {
    port: 3000
  },
  vite: {
    server: {
      watch: {
        ignored: [
          '**/storage/**/*',
          '**/*.json',
          '**/*.yml',
          '**/*.yaml',
          '**/*.img',
          '**/*.dmg',
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**'
        ]
      }
    }
  }
});