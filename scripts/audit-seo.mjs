// SEO-аудит собранного сайта (dist/) без JS: читает статический HTML так, как его видит робот.
// Запуск: npm run audit (после сборки). Код выхода 1 — есть ошибки; предупреждения не валят.
//
// Проверяет:
//  - мета: title (≤60, уникальный), description (120–160, уникальный), lang, viewport, theme-color,
//    canonical (абсолютный, = URL страницы), OG/Twitter, favicon-набор, manifest, robots noindex только где задумано;
//  - структура: ровно один H1, без пропуска уровней заголовков, контент в исходном HTML (main не пустой);
//  - изображения: alt, width/height, существование файлов (src/srcset, в т.ч. в <source>), lazy вне первого экрана;
//  - ссылки: все внутренние href резолвятся в файл в dist, якоря #id существуют, URL со слэшем;
//  - JSON-LD: парсится, есть @context/@type, нет AggregateRating/Review без реальных отзывов;
//  - sitemap/robots: абсолютные URL, все индексируемые страницы и ни одной noindex/404, Sitemap/Host/Clean-param;
//  - прайс: каждая цена из data/prices.json есть в HTML /ceny/ без JS;
//  - бюджеты: размер HTML (gzip)/CSS/JS, отсутствие внешних запросов (шрифты/скрипты с чужих доменов).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse } from 'node-html-parser';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
if (!existsSync(DIST)) {
  console.error('dist/ не найден — сначала npm run build');
  process.exit(1);
}

const { SITE } = await import('../src/config/site.ts');
const { reviews } = await import('../src/data/reviews.ts');
const prices = JSON.parse(readFileSync(join(ROOT, 'data/prices.json'), 'utf8'));

const ORIGIN = new URL(SITE.url).origin;
/** Страницы, где noindex задуман (см. src/lib/noindex.ts). */
const EXPECTED_NOINDEX = new Set([
  '/politika-konfidencialnosti/', '/soglasie/', '/404/',
  ...(reviews.length === 0 ? ['/otzyvy/'] : []),
]);
const TITLE_MAX = 60;
const DESC_MIN = 120;
const DESC_MAX = 160;
// html — после gzip (так страница идёт по сети; CSS инлайнится в HTML), css/js — несжатые
const BUDGET = { html: 30_000, css: 30_000, js: 10_000 };

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

// ---------- файлы ----------
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST);
const rel = (p) => '/' + relative(DIST, p).split(sep).join('/');
const fileSet = new Set(files.map(rel));
const htmlFiles = files.filter((f) => f.endsWith('.html'));

/** dist-файл → URL страницы: /uslugi/index.html → /uslugi/, /404.html → /404/ */
const pageUrl = (f) => {
  const r = rel(f);
  if (r.endsWith('/index.html')) return r.slice(0, -'index.html'.length);
  return r.replace(/\.html$/, '/');
};

/** Резолв внутреннего пути в файл dist. */
function resolveTarget(pathname) {
  let p;
  try { p = decodeURI(pathname); } catch { p = pathname; }
  if (p.endsWith('/')) return fileSet.has(p + 'index.html') ? p + 'index.html' : null;
  if (fileSet.has(p)) return p;
  if (fileSet.has(p + '/index.html')) return p + '/index.html';
  return null;
}

// ---------- разбор страниц ----------
const pages = new Map(); // url → { root, ids, file }
for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8');
  const root = parse(html, { comment: false });
  const ids = new Set(root.querySelectorAll('[id]').map((el) => el.getAttribute('id')));
  pages.set(pageUrl(f), { root, ids, file: f, size: Buffer.byteLength(html), gz: gzipSync(html).length });
}

const titles = new Map();
const descs = new Map();
const indexable = new Set();
const linkedFrom = new Map(); // url → Set(pages)

const isInternal = (href) => {
  if (!href) return false;
  if (/^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return false;
  if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
    try { return new URL(href, ORIGIN).origin === ORIGIN; } catch { return false; }
  }
  return true;
};

for (const [url, { root, ids, gz }] of pages) {
  const head = root.querySelector('head');
  const meta = (sel) => head?.querySelector(sel)?.getAttribute('content')?.trim();
  const is404 = url === '/404/';

  // --- базовые теги ---
  if (root.querySelector('html')?.getAttribute('lang') !== 'ru') err(url, 'lang≠"ru"');
  if (!meta('meta[name="viewport"]')?.includes('width=device-width')) err(url, 'нет viewport');
  if (!meta('meta[name="theme-color"]')) err(url, 'нет theme-color');
  if (!head?.querySelector('meta[charset]')) err(url, 'нет meta charset');

  const title = head?.querySelector('title')?.text.trim() ?? '';
  if (!title) err(url, 'нет <title>');
  else if (title.length > TITLE_MAX) err(url, `title ${title.length} симв. > ${TITLE_MAX}: «${title}»`);
  if (title) titles.set(title, [...(titles.get(title) ?? []), url]);

  const desc = meta('meta[name="description"]') ?? '';
  if (!desc) err(url, 'нет description');
  else if (desc.length < DESC_MIN || desc.length > DESC_MAX) {
    (is404 ? warn : err)(url, `description ${desc.length} симв. (нужно ${DESC_MIN}–${DESC_MAX}): «${desc}»`);
  }
  if (desc) descs.set(desc, [...(descs.get(desc) ?? []), url]);

  // --- robots ---
  const robots = (meta('meta[name="robots"]') ?? '').toLowerCase();
  const noindex = robots.includes('noindex');
  if (noindex && !EXPECTED_NOINDEX.has(url)) err(url, `неожиданный noindex («${robots}»)`);
  if (!noindex && EXPECTED_NOINDEX.has(url)) err(url, 'ожидался noindex');
  if (!noindex) indexable.add(url);

  // --- canonical / OG / Twitter ---
  const canonical = head?.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!is404) {
    if (!canonical) err(url, 'нет canonical');
    else if (canonical !== ORIGIN + url) err(url, `canonical ${canonical} ≠ ${ORIGIN + url}`);
  }
  for (const p of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:locale', 'og:site_name']) {
    if (!meta(`meta[property="${p}"]`) && !(is404 && p === 'og:url')) err(url, `нет ${p}`);
  }
  const ogImage = meta('meta[property="og:image"]');
  if (ogImage) {
    if (!/^https?:\/\//.test(ogImage)) err(url, 'og:image не абсолютный');
    else if (new URL(ogImage).origin === ORIGIN && !resolveTarget(new URL(ogImage).pathname)) err(url, `og:image не найден: ${ogImage}`);
  }
  for (const n of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!meta(`meta[name="${n}"]`)) err(url, `нет ${n}`);
  }

  // --- иконки / manifest ---
  const links = head?.querySelectorAll('link') ?? [];
  const relHas = (r) => links.filter((l) => (l.getAttribute('rel') ?? '').split(/\s+/).includes(r));
  if (!relHas('icon').length) err(url, 'нет link rel=icon');
  if (!relHas('icon').some((l) => l.getAttribute('type') === 'image/svg+xml')) warn(url, 'нет SVG-иконки');
  if (!relHas('apple-touch-icon').length) err(url, 'нет apple-touch-icon');
  if (!relHas('manifest').length) err(url, 'нет manifest');
  for (const l of links) {
    const href = l.getAttribute('href');
    if (isInternal(href) && !resolveTarget(new URL(href, ORIGIN + url).pathname)) err(url, `битый <link ${l.getAttribute('rel')}> ${href}`);
    if (href && /^https?:\/\//.test(href) && new URL(href).origin !== ORIGIN && /stylesheet|preload|icon/.test(l.getAttribute('rel') ?? '')) {
      warn(url, `внешний ресурс в <head>: ${href}`);
    }
  }
  for (const s of root.querySelectorAll('script[src]')) {
    const src = s.getAttribute('src');
    if (isInternal(src)) { if (!resolveTarget(new URL(src, ORIGIN + url).pathname)) err(url, `битый script ${src}`); }
    else warn(url, `внешний скрипт: ${src}`);
    if (head?.querySelectorAll('script[src]').includes(s) && !s.hasAttribute('defer') && !s.hasAttribute('async') && s.getAttribute('type') !== 'module') {
      err(url, `render-blocking script ${src}`);
    }
  }

  // --- заголовки ---
  const hs = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const h1 = hs.filter((h) => h.tagName === 'H1');
  if (h1.length !== 1) err(url, `H1: ${h1.length} шт.`);
  if (hs[0] && hs[0].tagName !== 'H1') warn(url, `первый заголовок ${hs[0].tagName}, а не H1`);
  let prev = 1;
  for (const h of hs) {
    const lvl = Number(h.tagName[1]);
    if (lvl > prev + 1) err(url, `пропуск уровня: ${h.tagName} после H${prev} («${h.text.trim().slice(0, 40)}»)`);
    if (!h.text.trim()) err(url, `пустой ${h.tagName}`);
    prev = lvl;
  }

  // --- контент без JS ---
  const main = root.querySelector('main');
  const text = (main?.text ?? '').replace(/\s+/g, ' ').trim();
  if (!main) err(url, 'нет <main>');
  else if (text.length < 300) warn(url, `мало текста в <main> без JS: ${text.length} симв.`);
  if (root.querySelector('noscript') && root.querySelector('noscript').text.length > 200) warn(url, 'контент внутри <noscript>');

  // --- изображения ---
  const imgs = root.querySelectorAll('img');
  imgs.forEach((img, i) => {
    const src = img.getAttribute('src');
    if (!img.hasAttribute('alt')) err(url, `img без alt: ${src}`);
    if (!img.getAttribute('width') || !img.getAttribute('height')) err(url, `img без width/height: ${src}`);
    if (i > 2 && img.getAttribute('loading') !== 'lazy') warn(url, `img ниже первого экрана без loading=lazy: ${src}`);
  });
  const srcs = [
    ...imgs.map((i) => i.getAttribute('src')),
    ...root.querySelectorAll('img[srcset], source[srcset]').flatMap((el) =>
      el.getAttribute('srcset').split(',').map((s) => s.trim().split(/\s+/)[0])),
  ].filter(Boolean);
  for (const s of new Set(srcs)) {
    if (isInternal(s) && !resolveTarget(new URL(s, ORIGIN + url).pathname)) err(url, `битое изображение ${s}`);
  }

  // --- ссылки ---
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href').trim();
    if (!a.text.trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]:not([alt=""])')) {
      err(url, `ссылка без текста: ${href}`);
    }
    if (href.startsWith('#')) {
      if (href.length > 1 && !ids.has(decodeURIComponent(href.slice(1)))) err(url, `якорь не найден: ${href}`);
      continue;
    }
    if (!isInternal(href)) continue;
    const u = new URL(href, ORIGIN + url);
    const target = resolveTarget(u.pathname);
    if (!target) { err(url, `битая ссылка: ${href}`); continue; }
    if (target.endsWith('.html') && !u.pathname.endsWith('/')) warn(url, `ссылка без завершающего слэша: ${href}`);
    if (target.endsWith('.html')) {
      const tUrl = target.endsWith('/index.html') ? target.slice(0, -'index.html'.length) : target.replace(/\.html$/, '/');
      if (!linkedFrom.has(tUrl)) linkedFrom.set(tUrl, new Set());
      if (tUrl !== url) linkedFrom.get(tUrl).add(url);
      if (u.hash.length > 1 && !pages.get(tUrl)?.ids.has(decodeURIComponent(u.hash.slice(1)))) err(url, `якорь не найден: ${href}`);
    }
  }
  // формы: action внутренний должен существовать
  for (const f of root.querySelectorAll('form[action]')) {
    const action = f.getAttribute('action');
    if (isInternal(action) && !resolveTarget(new URL(action, ORIGIN + url).pathname)) err(url, `form action не найден: ${action}`);
  }

  // --- JSON-LD ---
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(s.innerHTML); } catch (e) { err(url, `JSON-LD не парсится: ${e.message}`); continue; }
    const nodes = [];
    const collect = (v) => {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') { nodes.push(v); Object.values(v).forEach(collect); }
    };
    collect(data);
    const top = Array.isArray(data) ? data : [data];
    for (const t of top) {
      if (!t['@context'] && !t['@graph']) err(url, 'JSON-LD без @context');
      if (!t['@type'] && !t['@graph']) err(url, 'JSON-LD без @type');
    }
    for (const n of nodes) {
      const type = [].concat(n['@type'] ?? []);
      if ((type.includes('AggregateRating') || n.aggregateRating || type.includes('Review') || n.review) && reviews.length === 0) {
        err(url, 'JSON-LD: рейтинг/отзывы без реальных отзывов');
      }
      if (type.includes('Offer') && (n.price === undefined || !n.priceCurrency)) err(url, 'JSON-LD Offer без price/priceCurrency');
      for (const [k, v] of Object.entries(n)) {
        // домен-плейсхолдер в URL не считаем — о нём одно общее предупреждение ниже
        if (typeof v === 'string' && /TODO/i.test(v.split(ORIGIN).join(''))) warn(url, `JSON-LD ${type.join('/') || '?'}.${k} содержит TODO`);
      }
    }
  }

  if (gz > BUDGET.html) warn(url, `HTML ${(gz / 1024).toFixed(1)} КБ gzip > ${BUDGET.html / 1000} КБ`);
}

// --- уникальность ---
for (const [t, urls] of titles) if (urls.length > 1) err(urls.join(', '), `одинаковый title «${t}»`);
for (const [d, urls] of descs) if (urls.length > 1) err(urls.join(', '), `одинаковый description «${d.slice(0, 50)}…»`);

// --- страницы-сироты ---
for (const url of indexable) {
  if (url !== '/' && !(linkedFrom.get(url)?.size)) warn(url, 'страница-сирота: на неё нет внутренних ссылок');
}

// --- sitemap ---
const smIndex = join(DIST, 'sitemap-index.xml');
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!existsSync(smIndex)) err('sitemap', 'нет sitemap-index.xml');
else {
  const sitemapUrls = [];
  for (const sm of locs(readFileSync(smIndex, 'utf8'))) {
    if (!sm.startsWith(ORIGIN + '/')) err('sitemap', `не абсолютный/чужой URL: ${sm}`);
    const f = join(DIST, new URL(sm).pathname);
    if (!existsSync(f)) { err('sitemap', `нет файла ${sm}`); continue; }
    sitemapUrls.push(...locs(readFileSync(f, 'utf8')));
  }
  const inSitemap = new Set();
  for (const loc of sitemapUrls) {
    if (!loc.startsWith(ORIGIN + '/')) { err('sitemap', `не абсолютный/чужой URL: ${loc}`); continue; }
    const p = new URL(loc).pathname;
    inSitemap.add(p);
    if (!p.endsWith('/')) err('sitemap', `URL без слэша: ${loc}`);
    if (!pages.has(p)) err('sitemap', `URL не существует в dist: ${loc}`);
    else if (!indexable.has(p)) err('sitemap', `noindex-страница в sitemap: ${loc}`);
    if (p.startsWith('/404')) err('sitemap', '404 в sitemap');
  }
  for (const p of indexable) if (!inSitemap.has(p)) err('sitemap', `индексируемая страница не в sitemap: ${p}`);
}

// --- robots.txt ---
const robotsPath = join(DIST, 'robots.txt');
if (!existsSync(robotsPath)) err('robots.txt', 'нет файла');
else {
  const r = readFileSync(robotsPath, 'utf8');
  const sm = r.match(/^Sitemap:\s*(\S+)/m)?.[1];
  if (!sm) err('robots.txt', 'нет Sitemap');
  else if (!sm.startsWith(ORIGIN + '/') || !existsSync(join(DIST, new URL(sm).pathname))) err('robots.txt', `Sitemap указывает не на файл сайта: ${sm}`);
  if (!/^Host:\s*\S+/m.test(r)) err('robots.txt', 'нет Host (Яндекс)');
  if (!/^Clean-param:/m.test(r)) err('robots.txt', 'нет Clean-param (Яндекс)');
  if (/^Disallow:\s*\/\s*$/m.test(r)) err('robots.txt', 'Disallow: / закрывает весь сайт');
}

// --- manifest ---
const manifestPath = join(DIST, 'site.webmanifest');
if (existsSync(manifestPath)) {
  try {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const i of m.icons ?? []) if (!resolveTarget(i.src)) err('manifest', `иконка не найдена: ${i.src}`);
    if (!(m.icons ?? []).some((i) => i.sizes === '512x512')) warn('manifest', 'нет иконки 512x512');
  } catch (e) { err('manifest', `не парсится: ${e.message}`); }
}

// --- прайс: все цены из prices.json есть в /ceny/ ---
const ceny = pages.get('/ceny/');
if (!ceny) err('/ceny/', 'страница не найдена');
else {
  const shown = new Set(ceny.root.querySelectorAll('[data-price]').map((el) => Number(el.getAttribute('data-price'))));
  for (const s of prices.services) for (const row of s.prices) {
    if (!shown.has(row.price)) err('/ceny/', `нет цены ${row.price} (${s.name}, ${row.label})`);
  }
}

// --- CSS: url() резолвятся; бюджеты ---
let cssTotal = 0;
let jsTotal = 0;
for (const f of files) {
  const r = rel(f);
  if (r.endsWith('.css')) {
    const css = readFileSync(f, 'utf8');
    cssTotal += Buffer.byteLength(css);
    for (const [, u] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (u.startsWith('data:') || u.startsWith('#') || /^https?:/.test(u)) continue;
      if (!resolveTarget(posix.join(posix.dirname(r), u).replace(/^(?!\/)/, '/'))) err(r, `битый url() ${u}`);
    }
  }
  if (r.endsWith('.js')) jsTotal += statSync(f).size;
}
// инлайновые стили/скрипты на главной — тоже в бюджет
const home = pages.get('/');
const inlineCss = home ? home.root.querySelectorAll('style').reduce((n, s) => n + Buffer.byteLength(s.innerHTML), 0) : 0;
const inlineJs = home ? home.root.querySelectorAll('script:not([type="application/ld+json"]):not([src])').reduce((n, s) => n + Buffer.byteLength(s.innerHTML), 0) : 0;
if (cssTotal + inlineCss > BUDGET.css) warn('budget', `CSS ${((cssTotal + inlineCss) / 1024).toFixed(1)} КБ > ${BUDGET.css / 1000} КБ`);
if (jsTotal + inlineJs > BUDGET.js) warn('budget', `JS ${((jsTotal + inlineJs) / 1024).toFixed(1)} КБ > ${BUDGET.js / 1000} КБ`);

// ---------- отчёт ----------
const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;
console.log(`audit-seo: страниц ${pages.size} (индексируемых ${indexable.size}), файлов ${files.length}; ` +
  `CSS ${kb(cssTotal)} файлом + ${kb(inlineCss)} инлайн, JS ${kb(jsTotal)} файлами + ${kb(inlineJs)} инлайн (главная), ` +
  `HTML главной ${kb(home?.size ?? 0)} (${kb(home?.gz ?? 0)} gzip)`);
if (!SITE.url.includes('TODO') && !/todo/i.test(ORIGIN)) { /* домен заполнен */ } else {
  warnings.push(`site: домен-плейсхолдер ${ORIGIN} — canonical/OG/sitemap/robots сменятся после заполнения SITE.url`);
}
for (const w of new Set(warnings)) console.log(`  warn  ${w}`);
for (const e of new Set(errors)) console.log(`  ERROR ${e}`);
console.log(errors.length ? `✗ ошибок: ${errors.length}, предупреждений: ${warnings.length}` : `✓ ошибок нет, предупреждений: ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
