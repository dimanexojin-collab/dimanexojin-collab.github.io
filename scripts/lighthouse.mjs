// Lighthouse по ключевым страницам (mobile + desktop) на собранном сайте.
// 1) npm run build:fast  2) npm run preview (в другом окне)  3) npm run lighthouse [-- base-url]
// Нужен Chrome или Edge (путь можно задать через CHROME_PATH). Отчёты JSON — в .lighthouse/.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const PAGES = ['/', '/ceny/', '/uslugi/lpg-massazh/', '/abonementy/siluet-premium/'];
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chromePath = CANDIDATES.find((p) => existsSync(p));

const OUT = new URL('../.lighthouse/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
const rows = [];
try {
  for (const formFactor of ['mobile', 'desktop']) {
    for (const path of PAGES) {
      const config = formFactor === 'desktop'
        ? (await import('lighthouse/core/config/desktop-config.js')).default
        : undefined;
      const { lhr } = await lighthouse(BASE + path, {
        port: chrome.port, output: 'json', logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      }, config);
      const c = lhr.categories;
      const a = lhr.audits;
      const row = {
        page: path, ff: formFactor,
        perf: Math.round(c.performance.score * 100),
        a11y: Math.round(c.accessibility.score * 100),
        bp: Math.round(c['best-practices'].score * 100),
        seo: Math.round(c.seo.score * 100),
        LCP: a['largest-contentful-paint'].displayValue,
        CLS: a['cumulative-layout-shift'].displayValue,
        TBT: a['total-blocking-time'].displayValue,
        FCP: a['first-contentful-paint'].displayValue,
      };
      rows.push(row);
      const failed = Object.values(a)
        .filter((x) => x.score !== null && x.score < 0.9 && ['binary', 'numeric', 'metricSavings'].includes(x.scoreDisplayMode) && x.id !== 'final-screenshot')
        .map((x) => `${x.id}${x.displayValue ? ` (${x.displayValue})` : ''}`);
      row.issues = failed.join('; ');
      const name = `${formFactor}${path.replace(/\//g, '_') || '_'}.json`;
      writeFileSync(new URL(name, OUT), JSON.stringify(lhr));
    }
  }
} finally {
  await chrome.kill();
}
console.table(rows.map(({ issues, ...r }) => r));
for (const r of rows) if (r.issues) console.log(`${r.ff} ${r.page}: ${r.issues}`);
