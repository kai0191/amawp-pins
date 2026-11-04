import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { GOOGLE_FONTS_URL } from './src/designer/styles.js';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  // GitHub Pages serves the site from /amawp-pins/. Override with BASE_PATH if you use a custom domain.
  base: process.env.BASE_PATH || '/amawp-pins/',
  plugins: [
    preact(),
    {
      name: 'fonts-url',
      transformIndexHtml: {
        order: 'post',
        handler: (html) => html.replace('<!--FONTS-->', `<link rel="stylesheet" href="${GOOGLE_FONTS_URL.replace(/&/g, '&amp;')}" />`),
      },
    },
  ],
  server: { fs: { allow: ['..'] } },
  build: { outDir: fileURLToPath(new URL('../dist', import.meta.url)), emptyOutDir: true, sourcemap: false },
});
