import { servicePages } from '../data/service-pages.ts';

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  {
    label: 'Услуги',
    href: '/uslugi/',
    children: servicePages.map((p) => ({ label: p.name, href: `/uslugi/${p.slug}/` })),
  },
  { label: 'Цены', href: '/ceny/' },
  { label: 'Абонементы', href: '/abonementy/' },
  { label: 'Акции', href: '/akcii/' },
  { label: 'О студии', href: '/o-studii/' },
  { label: 'Контакты', href: '/kontakty/' },
];

export const footerNav: NavItem[] = [
  { label: 'Услуги', href: '/uslugi/' },
  { label: 'Прайс-лист', href: '/ceny/' },
  { label: 'Комплексы и курсы', href: '/abonementy/' },
  { label: 'Акции', href: '/akcii/' },
  { label: 'Первый визит', href: '/pervyj-vizit/' },
  { label: 'Вопросы и противопоказания', href: '/faq/' },
  { label: 'Отзывы', href: '/otzyvy/' },
  { label: 'О студии', href: '/o-studii/' },
  { label: 'Контакты', href: '/kontakty/' },
];

/** Активный пункт: точное совпадение или раздел (для /uslugi/… и /abonementy/…). */
export const isActive = (href: string, path: string): boolean =>
  href === '/' ? path === '/' : path === href || path.startsWith(href);
