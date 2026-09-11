import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error - plain JS module, no types needed for a build-only plugin
import { studioPlugin } from './scripts/studio-plugin.mjs';

// GitHub Pages serves project sites from /<repo>/, so the deploy workflow sets
// BASE_PATH. Everything else (local dev, Netlify, a plain static host) uses "/".
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), studioPlugin()],
  build: {
    target: 'es2022',
    // Audio lives in public/songs and is copied verbatim; nothing to inline.
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
