/**
 * Title / description / canonical. Цены в title и description считаются из prices.json.
 * Плейсхолдеры с TODO (город, телефон) в мета-теги не попадают — см. filled() в site.ts.
 */
import { SITE, inCity, phoneFilled } from '../config/site.ts';
import {
  getService, minPrice, minPerSession, min10, singleRow, services, trialRow,
  packageProcedures, packageSavings, itemServiceName, PACKAGE_KIND_LABEL, type Package, type Service,
} from '../data/catalog.ts';
import type { ServicePage } from '../data/service-pages.ts';
import { formatPrice, formatMinutes, plural, PROCEDURE_FORMS } from './format.ts';

export const TITLE_MAX = 60;
export const DESC_MAX = 160;
export const OG_DEFAULT = '/og/default.jpg';

/** Абсолютный URL со слэшем на конце для страниц. */
export function absUrl(path: string): string {
  return new URL(path, SITE.url).href;
}

/** Если title длиннее лимита — пробуем без суффикса бренда. */
export function fitTitle(main: string, suffix = ''): string {
  const full = main + suffix;
  return full.length <= TITLE_MAX || !suffix ? full : main;
}

/** Обрезка description по границе слова. */
export function fitDescription(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= DESC_MAX) return t;
  const cut = t.slice(0, DESC_MAX - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.:;—–-]+$/, '') + '…';
}

const bookingTail = (): string => {
  const phone = phoneFilled();
  return phone ? `Запись: ${phone}.` : 'Запись онлайн и по телефону.';
};

const pageServices = (p: ServicePage): Service[] => p.serviceIds.map(getService);

/** Цена «от …» для title страницы услуги. */
export const serviceFromPrice = (p: ServicePage): number =>
  p.priceMode === 'perSession' ? minPerSession(pageServices(p)) : minPrice(pageServices(p));

export function serviceTitle(p: ServicePage): string {
  const price = formatPrice(serviceFromPrice(p));
  const prefix = p.priceMode === 'perSession' ? 'цена от' : 'от';
  return `${p.name}${inCity()} — ${prefix} ${price}${p.titleTail}`;
}

export function serviceDescription(p: ServicePage): string {
  const list = pageServices(p);
  const single = Math.min(...list.map((s) => singleRow(s).price));
  const ten = min10(list);
  const trialSvc = services.find((s) => trialRow(s));
  const trial = trialSvc ? ` Пробный LPG — ${formatPrice(trialRow(trialSvc)!.price)}.` : '';
  const parts = [
    `${p.name} в студии «${SITE.name}»${inCity()}: ${formatMinutes(list.map((s) => s.minutes))}, 1 сеанс от ${formatPrice(single)}`,
    ten ? `, курс 10 сеансов от ${formatPrice(ten)}.` : '.',
    trial,
    ` ${bookingTail()}`,
  ];
  return fitDescription(parts.join(''));
}

export function packageTitle(p: Package): string {
  return fitTitle(`${p.name} — курс за ${formatPrice(p.price)}`, `, «${SITE.name}»`);
}

/** Краткий состав: «LPG массаж тела, УЗ кавитация, прессотерапия». */
export function packageComposition(p: Package): string {
  const texts = p.steps?.length ? p.steps.flatMap((s) => s.split('+')) : p.items;
  // «Прессотерапия» → «прессотерапия»; LPG, RF, УЗ, Sketch не трогаем
  const names = texts.map((t) => itemServiceName(t).replace(/^[А-ЯЁ](?=[а-яё])/, (c) => c.toLowerCase()));
  return [...new Set(names)].join(', ');
}

export function packageDescription(p: Package): string {
  const n = packageProcedures(p);
  const save = packageSavings(p);
  return fitDescription(
    `${PACKAGE_KIND_LABEL[p.kind]} «${p.name}»${inCity()}: ${n} ${plural(n, PROCEDURE_FORMS)} — ${packageComposition(p)}. Цена ${formatPrice(p.price)}${save ? `, выгода ~${formatPrice(save)}` : ''}. ${bookingTail()}`,
  );
}
