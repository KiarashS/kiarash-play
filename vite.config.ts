import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error - plain JS module, no types needed for a build-only plugin
import { studioPlugin } from './scripts/studio-plugin.mjs';

/**
 * Where the site will be served from.
 *
 * A custom domain serves the site at the root, a GitHub Pages project site
 * serves it from /<repo>/, and getting this wrong makes every script and
 * stylesheet 404 while the HTML still loads — a blank page with no error.
 * public/CNAME is the signal: its presence means a custom domain.
 */
function resolveBase(): string {
  if (process.env.BASE_PATH) return process.env.BASE_PATH;
  if (existsSync(fileURLToPath(new URL('./public/CNAME', import.meta.url)))) return '/';
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  return repo ? `/${repo}/` : '/';
}

export default defineConfig({
  base: resolveBase(),
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
