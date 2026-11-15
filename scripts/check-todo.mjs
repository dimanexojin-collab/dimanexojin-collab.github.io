// Список незаполненных (TODO) полей в src/config/site.ts (Node ≥ 23 импортирует .ts напрямую).
// Без аргументов — подробный список; `--summary` — одна строка (используется в `npm run build`).
// STRICT=1 — выход с кодом 1, если TODO остались в обязательных полях (REQUIRED_FIELDS).
import { SITE, REQUIRED_FIELDS, isTodo } from '../src/config/site.ts';

/** @type {{key: string, value: string}[]} */
const todos = [];
const PLACEHOLDER_NUMBER = /0{10}/; // tel:+70000000000, wa.me/70000000000

function walk(value, path) {
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
  }
  if (typeof value === 'string' && (/TODO/i.test(value) || PLACEHOLDER_NUMBER.test(value))) {
    todos.push({ key: path, value });
  }
}
walk(SITE, '');
if (SITE.geo.lat === 0 && SITE.geo.lon === 0) todos.push({ key: 'geo', value: 'lat/lon = 0' });

const optionalEmpty = Object.entries({
  formEndpoint: SITE.formEndpoint,
  'analytics.yandexMetrika': SITE.analytics.yandexMetrika,
}).filter(([, v]) => isTodo(v)).map(([k]) => k);

const base = (k) => k.replace(/\[\d+\].*$/, '');
const isReq = (k) => REQUIRED_FIELDS.some((r) => base(k) === r || base(k).startsWith(r + '.'));
const reqTodos = todos.filter((t) => isReq(t.key));

if (process.argv.includes('--summary')) {
  console.log(`check:todo: плейсхолдеров в site.ts — ${todos.length}, из них обязательных — ${reqTodos.length} (подробно: npm run check:todo)`);
} else {
  console.log(`Незаполненные поля src/config/site.ts (${todos.length}):`);
  for (const t of todos) console.log(`  ${isReq(t.key) ? '[обязательно]' : '[желательно] '} ${t.key.padEnd(24)} ${t.value}`);
  if (optionalEmpty.length) console.log(`Пустые опциональные (поведение по умолчанию): ${optionalEmpty.join(', ')}`);
}

if (process.env.STRICT === '1' && reqTodos.length) {
  console.error(`STRICT=1: не заполнены обязательные поля: ${[...new Set(reqTodos.map((t) => base(t.key)))].join(', ')}`);
  process.exit(1);
}
