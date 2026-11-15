/**
 * Централизованные данные студии. Всё, что неизвестно, — строка с префиксом `TODO`.
 * `npm run check:todo` выводит список незаполненных полей;
 * `STRICT=1 npm run build` падает, если TODO остались в обязательных полях (REQUIRED_FIELDS).
 *
 * Правило отображения: значения с TODO НЕ попадают в title/description/JSON-LD
 * (см. `filled()`), а в интерфейсе видны с классом `.todo`, чтобы их было легко заметить.
 */

export type DayCode = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su';

export const SITE = {
  url: 'https://dimanexojin-collab.github.io', // демо-адрес; заменить на боевой домен
  name: 'Контур',
  tagline: 'Аппаратная коррекция фигуры',
  city: 'Архангельск',
  /** Город в предложном падеже с предлогом: «в Казани». */
  cityPrepositional: 'в Архангельске',
  phone: '+7 (993) 193-91-93',
  phoneHref: 'tel:+79931939193',
  // ВНИМАНИЕ: предположение — тот же номер в WhatsApp. Подтвердить у владельца.
  whatsapp: 'https://wa.me/79931939193',
  telegram: 'https://t.me/TODO',
  vk: 'https://vk.ru/club238903472',
  instagram: 'TODO',
  email: 'TODO',
  address: {
    street: 'Московский проспект, 33',
    locality: 'Архангельск',
    region: 'Архангельская область',
    postalCode: 'TODO',
  },
  geo: { lat: 0, lon: 0 },
  yandexMapsUrl: 'https://yandex.ru/maps/?text=%D0%90%D1%80%D1%85%D0%B0%D0%BD%D0%B3%D0%B5%D0%BB%D1%8C%D1%81%D0%BA%2C%20%D0%9C%D0%BE%D1%81%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2C%2033',
  yandexMapWidget: 'TODO',
  howToGet: 'TODO: ориентиры, парковка',
  hours: [
    { days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as DayCode[], open: 'TODO 10:00', close: 'TODO 21:00' },
  ],
  legal: {
    entity: 'TODO: ИП/ООО',
    inn: 'TODO',
    ogrn: 'TODO',
    license: 'TODO: № мед. лицензии, если есть',
  },
  /** Ссылка на онлайн-запись (YCLIENTS/Dikidi). Пусто или TODO → используется форма/мессенджеры. */
  bookingUrl: 'TODO: YCLIENTS/Dikidi или пусто → форма',
  /** URL обработчика формы (POST). Пусто → форма заменяется кнопками мессенджеров. */
  formEndpoint: '',
  analytics: { yandexMetrika: '', yandexVerification: '', googleVerification: '' },
} as const;

/** Поля, без которых нельзя публиковать сайт (проверяются при STRICT=1). */
export const REQUIRED_FIELDS = [
  'url',
  'city',
  'cityPrepositional',
  'phone',
  'phoneHref',
  'whatsapp',
  'address.street',
  'address.locality',
  'hours',
  'legal.entity',
  'legal.inn',
] as const;

export const isTodo = (v: unknown): boolean =>
  typeof v === 'string' && (v.trim() === '' || /TODO/i.test(v));

/** Значение, если оно заполнено, иначе undefined. */
export function filled<T>(v: T): T | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') return isTodo(v) ? undefined : v;
  return v;
}

/** « в Казани» с ведущим пробелом или пустая строка, пока город не заполнен. */
export const inCity = (): string => {
  const c = filled(SITE.cityPrepositional);
  return c ? ` ${c}` : '';
};

export const phoneFilled = (): string | undefined =>
  filled(SITE.phone) && !/0{10}/.test(SITE.phoneHref) ? SITE.phone : undefined;

export const hoursFilled = () =>
  SITE.hours.every((h) => !isTodo(h.open) && !isTodo(h.close)) ? SITE.hours : undefined;

export const geoFilled = () => (SITE.geo.lat !== 0 || SITE.geo.lon !== 0 ? SITE.geo : undefined);

/** Ссылки соцсетей, которые реально заполнены (для sameAs и футера). */
export const socialLinks = (): { name: string; href: string }[] =>
  [
    { name: 'WhatsApp', href: SITE.whatsapp },
    { name: 'Telegram', href: SITE.telegram },
    { name: 'ВКонтакте', href: SITE.vk },
    { name: 'Instagram', href: SITE.instagram },
  ].filter((s) => !isTodo(s.href) && /^https?:\/\//.test(s.href) && !/0{10}/.test(s.href));

/** Куда ведёт «Записаться»: онлайн-запись, если задана, иначе форма на /kontakty/. */
export const bookingHref = (): string => {
  const url = filled(SITE.bookingUrl);
  return url && /^https?:\/\//.test(url) ? url : '/kontakty/#zapis';
};
export const bookingIsExternal = (): boolean => /^https?:\/\//.test(bookingHref());

/** Ссылка WhatsApp с предзаполненным текстом. */
export const whatsappLink = (text?: string): string =>
  text ? `${SITE.whatsapp}?text=${encodeURIComponent(text)}` : SITE.whatsapp;

export const DAY_NAMES: Record<DayCode, string> = {
  Mo: 'Пн', Tu: 'Вт', We: 'Ср', Th: 'Чт', Fr: 'Пт', Sa: 'Сб', Su: 'Вс',
};

export const DAY_SCHEMA: Record<DayCode, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
};

/** Человекочитаемый график: «Пн–Вс 10:00–21:00». */
export function hoursText(): string[] {
  return SITE.hours.map((h) => {
    const days = h.days.length > 1 ? `${DAY_NAMES[h.days[0]]}–${DAY_NAMES[h.days[h.days.length - 1]]}` : DAY_NAMES[h.days[0]];
    return `${days} ${h.open}–${h.close}`;
  });
}
