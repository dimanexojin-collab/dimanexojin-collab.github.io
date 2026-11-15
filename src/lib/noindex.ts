import { reviews } from '../data/reviews.ts';

/**
 * Страницы с `noindex` — исключаются из sitemap (astro.config.mjs) и получают meta robots.
 * /otzyvy/ закрыта, пока нет реальных отзывов (иначе — тонкий контент).
 */
export const NOINDEX_PATHS: string[] = [
  '/politika-konfidencialnosti/',
  '/soglasie/',
  '/404/',
  ...(reviews.length === 0 ? ['/otzyvy/'] : []),
];

export const isNoindex = (path: string): boolean => NOINDEX_PATHS.includes(path);
