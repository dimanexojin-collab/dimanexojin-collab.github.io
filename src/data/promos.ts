/**
 * Акции строятся только из данных прайса. Сроки и условия — TODO от клиента (см. QUESTIONS.md),
 * поэтому даты и «только до…» не выдумываем.
 */
import { services, trialRow, singleRow, packages, packageSavings, fullName, type Package } from './catalog.ts';

export interface Promo {
  id: string;
  title: string;
  text: string;
  price: number;
  /** Обычная цена для сравнения (если есть) */
  regular?: number;
  href: string;
  /** Условия от клиента; пока не получены — undefined */
  terms?: string;
}

const trialService = services.find((s) => trialRow(s));

export const trialPromo: Promo | undefined = trialService && {
  id: 'trial-lpg',
  title: 'Пробный сеанс LPG',
  text: `Познакомьтесь с LPG массажем: пробный сеанс — ${fullName(trialService)}.`,
  price: trialRow(trialService)!.price,
  regular: singleRow(trialService).price,
  href: '/uslugi/lpg-massazh/',
};

const bundlePromo = (p: Package): Promo => ({
  id: p.slug,
  title: p.name,
  text: p.items.join(' + '),
  price: p.price,
  regular: (packageSavings(p) ?? 0) > 0 ? p.price + packageSavings(p)! : undefined,
  href: `/abonementy/${p.slug}/`,
});

export const promos: Promo[] = [
  ...(trialPromo ? [trialPromo] : []),
  ...packages.filter((p) => p.kind === 'bundle').map(bundlePromo),
];
