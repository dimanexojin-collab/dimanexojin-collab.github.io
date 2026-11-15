/**
 * Слой данных над data/prices.json — единственным источником цен.
 * Здесь: типы, валидация при сборке, группировка, расчёты (мин. цена, цена за сеанс, экономия),
 * нормализация названий и поиск курсов, в которые входит услуга.
 * Сам JSON не правим: спорные места вынесены в QUESTIONS.md.
 */
import raw from '../../data/prices.json';

export interface PriceRow {
  label: string;
  sessions: number;
  price: number;
  trial?: boolean;
  /** Явно указанная цена за сеанс (Sketch). Иначе считается price / sessions. */
  perSession?: number;
}

export interface Service {
  id: string;
  group: string;
  name: string;
  minutes: number;
  isNew?: boolean;
  prices: PriceRow[];
}

export type PackageKind = 'complex' | 'course' | 'bundle';

export interface Package {
  /** id из prices.json */
  id: string;
  /** латинский slug для URL /abonementy/{slug}/ */
  slug: string;
  kind: PackageKind;
  name: string;
  price: number;
  /** Состав «N сеансов X (M мин)» */
  items: string[];
  /** Пошаговый план визитов (только «Силуэт Премиум») */
  steps?: string[];
}

interface RawData {
  currency: string;
  services: Service[];
  lpgSketchBundles: { id: string; title: string; items: string[]; price: number }[];
  complexes: { id: string; name: string; price: number; items: string[] }[];
  courses: { id: string; name: string; price: number; items?: string[]; steps?: string[] }[];
}

/* ------------------------------------------------------------------ валидация */

function fail(msg: string): never {
  throw new Error(`[data/prices.json] ${msg}`);
}

function validate(d: RawData): RawData {
  if (d.currency !== 'RUB') fail(`ожидалась валюта RUB, получено ${d.currency}`);
  if (!Array.isArray(d.services) || d.services.length === 0) fail('нет services');
  const ids = new Set<string>();
  for (const s of d.services) {
    if (!s.id || ids.has(s.id)) fail(`пустой или повторяющийся id услуги: ${s.id}`);
    ids.add(s.id);
    if (!s.name || !s.group) fail(`${s.id}: нет name/group`);
    if (!Number.isInteger(s.minutes) || s.minutes <= 0) fail(`${s.id}: некорректные minutes`);
    if (!s.prices?.length) fail(`${s.id}: нет prices`);
    for (const p of s.prices) {
      if (!p.label || !Number.isInteger(p.sessions) || p.sessions <= 0) fail(`${s.id}: строка цены без label/sessions`);
      if (typeof p.price !== 'number' || p.price <= 0) fail(`${s.id} «${p.label}»: некорректная цена`);
    }
    if (!s.prices.some((p) => p.sessions === 1 && !p.trial)) fail(`${s.id}: нет цены за 1 сеанс`);
    if (!GROUP_META[s.group]) fail(`${s.id}: группа «${s.group}» не описана в GROUP_META (catalog.ts)`);
  }
  const all = [...d.complexes, ...d.courses, ...d.lpgSketchBundles];
  for (const p of all) {
    if (!PACKAGE_SLUGS[p.id]) fail(`пакет ${p.id}: нет slug в PACKAGE_SLUGS (catalog.ts)`);
    if (typeof p.price !== 'number' || p.price <= 0) fail(`пакет ${p.id}: некорректная цена`);
    const hasItems = 'items' in p && Array.isArray(p.items) && p.items.length > 0;
    const hasSteps = 'steps' in p && Array.isArray(p.steps) && p.steps.length > 0;
    if (!hasItems && !hasSteps) fail(`пакет ${p.id}: нет items/steps`);
  }
  return d;
}

/* ------------------------------------------------------------------ справочники */

/** Отображение групп прайса: якорь для /ceny/#… и подпись вкладки. */
export const GROUP_META: Record<string, { anchor: string; label: string }> = {
  LPG: { anchor: 'lpg', label: 'LPG' },
  RF: { anchor: 'rf', label: 'RF лифтинг' },
  'Кавитация': { anchor: 'kavitaciya', label: 'Кавитация' },
  Sketch: { anchor: 'sketch', label: 'Sketch' },
  'Прочее': { anchor: 'lipoliz-biofoton', label: 'Липолиз и Биофотон' },
  'Вакуумный массаж': { anchor: 'vakuum', label: 'Вакуумный массаж' },
  'Прессотерапия': { anchor: 'pressoterapiya', label: 'Прессотерапия' },
  'Вибромассаж': { anchor: 'vibromassazh', label: 'Вибромассаж' },
};

/** id пакета → slug (из PLAN.md). */
export const PACKAGE_SLUGS: Record<string, string> = {
  'volume-reduction': 'umenshenie-obyomov',
  'edema-relief': 'snyatie-otyokov',
  'skin-lifting': 'podtyazhka-kozhi',
  'anti-cellulite': 'anticellyulit',
  'dream-figure': 'figura-mechty',
  'figure-modeling-1': 'modelirovanie-figury-1',
  'figure-modeling-2': 'modelirovanie-figury-2',
  'slimness-formula': 'formula-strojnosti',
  'silhouette-premium': 'siluet-premium',
  'lpg25-sketch': 'lpg-25-sketch',
  'lpg45-sketch': 'lpg-45-sketch',
};

export const PACKAGE_KIND_LABEL: Record<PackageKind, string> = {
  complex: 'Комплекс',
  course: 'Курс',
  bundle: 'Абонемент 5+5',
};

/**
 * «Семейства» услуг: как распознать услугу в текстовом составе курса.
 * Используется для перелинковки (услуга ↔ курсы) и расчёта выгоды.
 */
const FAMILIES: { key: string; test: (t: string) => boolean; ids: string[] }[] = [
  { key: 'lpg-face', test: (t) => /LPG/i.test(t) && /лиц/i.test(t), ids: ['lpg-face-20'] },
  { key: 'lpg-body', test: (t) => /LPG/i.test(t) && !/лиц/i.test(t), ids: ['lpg-body-25', 'lpg-body-45'] },
  { key: 'sketch', test: (t) => /sketch/i.test(t), ids: ['sketch-40'] },
  { key: 'rf-face', test: (t) => /RF/.test(t) && /лиц/i.test(t), ids: ['rf-face-20'] },
  { key: 'rf-body', test: (t) => /RF/.test(t) && !/лиц/i.test(t), ids: ['rf-body-30'] },
  { key: 'cavitation', test: (t) => /кавитац/i.test(t), ids: ['cavitation-20', 'cavitation-40'] },
  { key: 'pressotherapy', test: (t) => /прессотерап/i.test(t), ids: ['pressotherapy-30', 'pressotherapy-45'] },
  { key: 'vibro', test: (t) => /вибр/i.test(t) && !/ше[ия]/i.test(t), ids: ['vibro-40'] },
  { key: 'vibro-neck', test: (t) => /вибр/i.test(t) && /ше[ия]/i.test(t), ids: ['vibro-neck-10'] },
  { key: 'vacuum', test: (t) => /вакуум/i.test(t), ids: ['vacuum-30', 'vacuum-45'] },
  { key: 'laser', test: (t) => /липолиз/i.test(t), ids: ['laser-lipolysis-30'] },
  { key: 'biophoton', test: (t) => /биофотон/i.test(t), ids: ['biophoton-30'] },
];

/* ------------------------------------------------------------------ данные */

const data = validate(raw as RawData);

export const currency = data.currency;
export const services: readonly Service[] = data.services;

export const packages: readonly Package[] = [
  ...data.complexes.map((c): Package => ({ id: c.id, slug: PACKAGE_SLUGS[c.id], kind: 'complex', name: c.name, price: c.price, items: c.items })),
  ...data.courses.map((c): Package => ({ id: c.id, slug: PACKAGE_SLUGS[c.id], kind: 'course', name: c.name, price: c.price, items: c.items ?? [], steps: c.steps })),
  ...data.lpgSketchBundles.map((b): Package => ({ id: b.id, slug: PACKAGE_SLUGS[b.id], kind: 'bundle', name: b.title, price: b.price, items: b.items })),
];

export const getService = (id: string): Service => services.find((s) => s.id === id) ?? fail(`нет услуги ${id}`);
export const getPackage = (slug: string): Package | undefined => packages.find((p) => p.slug === slug);

/** Группы прайса в порядке появления в JSON. */
export function groups(): { group: string; anchor: string; label: string; services: Service[] }[] {
  const map = new Map<string, Service[]>();
  for (const s of services) map.set(s.group, [...(map.get(s.group) ?? []), s]);
  return [...map].map(([group, list]) => ({ group, ...GROUP_META[group], services: list }));
}

/* ------------------------------------------------------------------ названия */

/** «LPG тело»/«LPG тела» → «LPG массаж тела»; остальные без изменений. */
export function displayName(s: Service): string {
  if (/^LPG тел[оа]$/i.test(s.name)) return 'LPG массаж тела';
  if (/^LPG лица$/i.test(s.name)) return 'LPG массаж лица';
  return s.name;
}

/** «LPG массаж тела (25 мин)» */
export const fullName = (s: Service): string => `${displayName(s)} (${s.minutes} мин)`;

/* ------------------------------------------------------------------ расчёты */

export const singleRow = (s: Service): PriceRow => s.prices.find((p) => p.sessions === 1 && !p.trial)!;
export const trialRow = (s: Service): PriceRow | undefined => s.prices.find((p) => p.trial);

/** Цена за один сеанс в строке прайса. */
export const perSession = (row: PriceRow): number => row.perSession ?? Math.round(row.price / row.sessions);

/** Экономия строки абонемента относительно разовых сеансов (0 для 1 сеанса). */
export function savings(s: Service, row: PriceRow): number {
  if (row.sessions <= 1 || row.trial) return 0;
  return Math.max(0, singleRow(s).price * row.sessions - row.price);
}

/** Минимальная цена по набору услуг (по умолчанию с учётом пробного сеанса). */
export function minPrice(list: readonly Service[], opts: { includeTrial?: boolean } = {}): number {
  const { includeTrial = true } = opts;
  return Math.min(...list.flatMap((s) => s.prices.filter((p) => includeTrial || !p.trial).map((p) => p.price)));
}

/** Минимальная цена за сеанс по набору услуг (без пробного). */
export const minPerSession = (list: readonly Service[]): number =>
  Math.min(...list.flatMap((s) => s.prices.filter((p) => !p.trial).map(perSession)));

/** Минимальная цена курса из 10 сеансов (undefined, если таких строк нет). */
export function min10(list: readonly Service[]): number | undefined {
  const rows = list.flatMap((s) => s.prices.filter((p) => p.sessions === 10));
  return rows.length ? Math.min(...rows.map((p) => p.price)) : undefined;
}

export const isNewAny = (list: readonly Service[]): boolean => list.some((s) => s.isNew);

export const minPackagePrice =(): number => Math.min(...packages.map((p) => p.price));

/** Диапазон цен для JSON-LD priceRange: «400–25 000 ₽». */
export function priceRange(): string {
  const all = [...services.flatMap((s) => s.prices.map((p) => p.price)), ...packages.map((p) => p.price)];
  const f = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${f(Math.min(...all))}–${f(Math.max(...all))} ₽`;
}

/* ------------------------------------------------------------------ состав пакетов */

export interface ResolvedItem {
  text: string;
  count: number;
  minutes?: number;
  familyKey?: string;
  /** id услуги, если однозначно определена по названию и длительности */
  serviceId?: string;
}

/** Разбор строки «5 сеансов Sketch (40 мин)». */
export function resolveItem(text: string): ResolvedItem {
  const count = Number(text.match(/^(\d+)\s/)?.[1] ?? 1);
  const minutes = text.match(/\((\d+)\s*мин\)/)?.[1];
  const fam = FAMILIES.find((f) => f.test(text));
  const res: ResolvedItem = { text, count, minutes: minutes ? Number(minutes) : undefined, familyKey: fam?.key };
  if (fam) {
    const candidates = fam.ids.map(getService).filter((s) => res.minutes === undefined || s.minutes === res.minutes);
    if (candidates.length === 1) res.serviceId = candidates[0].id;
  }
  return res;
}

/** Нормализованное название услуги для строки состава (или исходный текст, если не распознана). */
export function itemServiceName(text: string): string {
  const r = resolveItem(text.trim());
  const id = r.serviceId ?? FAMILIES.find((f) => f.key === r.familyKey)?.ids[0];
  return id ? displayName(getService(id)) : text.trim().replace(/^\d+\s+\S+\s+/, '').replace(/\s*\(.*\)$/, '');
}

/** Все строки состава: items + каждая половинка шагов «A + B». */
const packageTexts = (p: Package): string[] => [...p.items, ...(p.steps ?? []).flatMap((s) => s.split('+'))];

/** Выгода пакета относительно разовых сеансов. undefined, если состав нельзя однозначно сопоставить с прайсом. */
export function packageSavings(p: Package): number | undefined {
  if (p.steps?.length || !p.items.length) return undefined;
  let sum = 0;
  for (const it of p.items.map(resolveItem)) {
    if (!it.serviceId) return undefined;
    sum += singleRow(getService(it.serviceId)).price * it.count;
  }
  return sum > p.price ? sum - p.price : undefined;
}

/** Общее число процедур в пакете (сеансы из items или визиты из steps). */
export const packageProcedures = (p: Package): number =>
  p.steps?.length ? p.steps.length : p.items.reduce((n, t) => n + resolveItem(t).count, 0);

/** Пакеты, в состав которых входит хотя бы одна из услуг (по семейству, без учёта длительности). */
export function packagesContaining(serviceIds: readonly string[]): Package[] {
  const fams = new Set(FAMILIES.filter((f) => f.ids.some((id) => serviceIds.includes(id))).map((f) => f.key));
  return packages.filter((p) => packageTexts(p).some((t) => {
    const fam = FAMILIES.find((f) => f.test(t));
    return fam && fams.has(fam.key);
  }));
}

/** id услуг, входящих в пакет (для ссылок «курс → услуги»). */
export function servicesInPackage(p: Package): string[] {
  const ids = new Set<string>();
  for (const t of packageTexts(p)) {
    const fam = FAMILIES.find((f) => f.test(t));
    fam?.ids.forEach((id) => ids.add(id));
  }
  return [...ids];
}
