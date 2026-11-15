/**
 * JSON-LD билдеры. Правила:
 *  - незаполненные (TODO) поля не выводятся;
 *  - никаких выдуманных рейтингов/отзывов: Review/AggregateRating только из data/reviews.ts.
 */
import { SITE, filled, phoneFilled, hoursFilled, geoFilled, socialLinks, DAY_SCHEMA } from '../config/site.ts';
import { getService, fullName, priceRange, currency, type Package } from '../data/catalog.ts';
import type { ServicePage } from '../data/service-pages.ts';
import type { FaqItem } from '../data/faq.ts';
import type { Review } from '../data/reviews.ts';
import { absUrl, OG_DEFAULT, packageDescription } from './seo.ts';

export type JsonLd = Record<string, unknown>;

export const BUSINESS_ID = () => absUrl('/#business');
const WEBSITE_ID = () => absUrl('/#website');

/** Удаляет undefined/пустые массивы, чтобы в разметку не попадали пустые поля. */
function clean<T extends JsonLd>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as T;
}

export function business(): JsonLd {
  const a = SITE.address;
  const address = filled(a.street)
    ? clean({
        '@type': 'PostalAddress',
        streetAddress: a.street,
        addressLocality: filled(a.locality),
        addressRegion: filled(a.region),
        postalCode: filled(a.postalCode),
        addressCountry: 'RU',
      })
    : undefined;
  const geo = geoFilled();
  const hours = hoursFilled();
  return clean({
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    '@id': BUSINESS_ID(),
    name: SITE.name,
    description: SITE.tagline,
    url: absUrl('/'),
    image: absUrl(OG_DEFAULT),
    logo: absUrl('/apple-touch-icon.png'),
    telephone: phoneFilled(),
    email: filled(SITE.email),
    priceRange: priceRange(),
    currenciesAccepted: currency,
    address,
    geo: geo && { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lon },
    hasMap: filled(SITE.twoGisUrl) ?? filled(SITE.yandexMapsUrl),
    openingHoursSpecification: hours?.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => `https://schema.org/${DAY_SCHEMA[d]}`),
      opens: h.open,
      closes: h.close,
    })),
    sameAs: socialLinks().map((s) => s.href),
  });
}

export function website(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID(),
    url: absUrl('/'),
    name: SITE.name,
    inLanguage: 'ru-RU',
    publisher: { '@id': BUSINESS_ID() },
  };
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbs(items: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absUrl(c.href),
    })),
  };
}

export function faqPage(items: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function serviceLd(p: ServicePage, description: string): JsonLd {
  const url = absUrl(`/uslugi/${p.slug}/`);
  const offers = p.serviceIds.map(getService).flatMap((s) =>
    s.prices.map((row) => ({
      '@type': 'Offer',
      name: `${fullName(s)}, ${row.label.toLowerCase()}`,
      price: row.price,
      priceCurrency: currency,
      url,
      availability: 'https://schema.org/InStock',
    })),
  );
  return clean({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: p.h1,
    serviceType: p.name,
    description,
    url,
    provider: { '@id': BUSINESS_ID() },
    areaServed: filled(SITE.city),
    offers,
  });
}

export function packageLd(p: Package): JsonLd {
  const url = absUrl(`/abonementy/${p.slug}/`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: packageDescription(p),
    url,
    image: absUrl(OG_DEFAULT),
    brand: { '@type': 'Brand', name: SITE.name },
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: currency,
      url,
      availability: 'https://schema.org/InStock',
      seller: { '@id': BUSINESS_ID() },
    },
  };
}

/** Только для реальных отзывов (data/reviews.ts). При пустом массиве — null. */
export function reviewsLd(list: Review[]): JsonLd | null {
  if (!list.length) return null;
  const rated = list.filter((r) => typeof r.rating === 'number');
  return clean({
    '@context': 'https://schema.org',
    '@id': BUSINESS_ID(),
    '@type': 'HealthAndBeautyBusiness',
    name: SITE.name,
    review: list.map((r) =>
      clean({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        datePublished: r.date,
        reviewBody: r.text,
        reviewRating: r.rating ? { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 } : undefined,
      }),
    ),
    aggregateRating: rated.length
      ? {
          '@type': 'AggregateRating',
          ratingValue: Math.round((rated.reduce((s, r) => s + r.rating!, 0) / rated.length) * 10) / 10,
          reviewCount: rated.length,
        }
      : undefined,
  });
}
