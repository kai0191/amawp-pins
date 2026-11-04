import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { GOOGLE_FONTS_URL } from './src/designer/styles.js';
import { seoHead } from './seo-build.js';

const SITE_URL = process.env.SITE_URL || 'https://kai0191.github.io/amawp-pins/';

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
        handler: (html) => {
          const seo = seoHead(SITE_URL);
          return html
            .replace('<!--FONTS-->', `<link rel="stylesheet" href="${GOOGLE_FONTS_URL.replace(/&/g, '&amp;')}" />\n    ${seo.head}`)
            .replace('<div id="app"></div>', `<div id="app"></div>\n    ${seo.body}`);
        },
      },
    },
  ],
  server: { fs: { allow: ['..'] } },
  build: { outDir: fileURLToPath(new URL('../dist', import.meta.url)), emptyOutDir: true, sourcemap: false },
});
