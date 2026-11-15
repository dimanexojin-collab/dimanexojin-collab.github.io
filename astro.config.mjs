// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/config/site.ts';
import { NOINDEX_PATHS } from './src/lib/noindex.ts';

export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    format: 'directory',
    // CSS ~18 КБ (≈4 КБ brotli) — инлайним, чтобы не было render-blocking запроса
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !NOINDEX_PATHS.includes(path) && !path.startsWith('/404');
      },
    }),
  ],
});
