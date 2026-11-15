/**
 * Только реальные отзывы клиентов (с согласия). Выдуманные отзывы и рейтинги не публикуем.
 * Пока массив пуст: блок отзывов скрыт, /otzyvy/ — noindex и вне sitemap,
 * Review/AggregateRating в JSON-LD не выводятся.
 */
export interface Review {
  author: string;
  /** ISO-дата: 2026-05-01 */
  date: string;
  text: string;
  /** Источник: «Яндекс Карты», «2ГИС», «лично в студии» */
  source: string;
  sourceUrl?: string;
  /** Оценка 1–5, только если указана в источнике */
  rating?: number;
}

export const reviews: Review[] = [];
