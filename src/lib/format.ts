/** Неразрывный пробел: между разрядами и перед ₽ — чтобы цена не переносилась. */
export const NBSP = ' ';

/** 1000 → «1 000», 25000 → «25 000» (разделитель — неразрывный пробел). */
export function formatNumber(n: number): string {
  const [int, frac] = Math.abs(Math.round(n * 100) / 100).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return (n < 0 ? '−' : '') + grouped + (frac ? ',' + frac : '');
}

/** 1000 → «1 000 ₽». */
export const formatPrice = (n: number): string => `${formatNumber(n)}${NBSP}₽`;

/** «от 1 000 ₽». */
export const formatFrom = (n: number): string => `от${NBSP}${formatPrice(n)}`;

/**
 * Склонение по числу: plural(5, ['сеанс', 'сеанса', 'сеансов']) → 'сеансов'.
 */
export function plural(n: number, forms: readonly [one: string, few: string, many: string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const SESSION_FORMS = ['сеанс', 'сеанса', 'сеансов'] as const;
export const PROCEDURE_FORMS = ['процедура', 'процедуры', 'процедур'] as const;
export const VISIT_FORMS = ['визит', 'визита', 'визитов'] as const;

/** 5 → «5 сеансов». */
export const sessions = (n: number): string => `${n}${NBSP}${plural(n, SESSION_FORMS)}`;

/** «20 мин», список длительностей «25 / 45 мин». */
export const formatMinutes = (list: number[]): string =>
  `${[...new Set(list)].sort((a, b) => a - b).join(' / ')}${NBSP}мин`;
