import type { APIRoute } from 'astro';
import { absUrl } from '../lib/seo.ts';
import { SITE } from '../config/site.ts';

export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    // noindex-страницы не закрываем Disallow: иначе робот не увидит meta robots
    '',
    'User-agent: Yandex',
    'Allow: /',
    // Host устарел для Яндекса (учитывается 301 + Вебмастер), но не мешает и фиксирует главное зеркало
    `Host: ${new URL(SITE.url).origin}`,
    'Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&yclid&gclid',
    '',
    `Sitemap: ${absUrl('/sitemap-index.xml')}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
