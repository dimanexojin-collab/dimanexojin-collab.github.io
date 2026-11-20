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
    // Общие стили кешируются между страницами вместо повторения в каждом HTML.
    inlineStylesheets: 'never',
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
