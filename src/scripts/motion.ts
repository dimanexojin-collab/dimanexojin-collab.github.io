/**
 * Движение сайта: reveal, count-up цен, лента процедур, ротатор, шапка, параллакс.
 * Работает только при html.m (класс ставит инлайн-скрипт в <head>, если нет prefers-reduced-motion).
 * Анимируются transform/opacity/filter; контент всегда есть в HTML.
 */
const root = document.documentElement;
(window as unknown as { __km: number }).__km = 1;

const mq = (q: string) => matchMedia(q).matches;
const finePointer = mq('(hover: hover) and (pointer: fine)');
const small = mq('(max-width: 767px)');
const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = document) => [...c.querySelectorAll<T>(s)];
const on = (t: EventTarget, e: string, f: EventListener, o: AddEventListenerOptions = { passive: true }) => t.addEventListener(e, f, o);

if (root.classList.contains('m')) {
  // ---------- Count-up цены (итоговое значение уже в HTML) ----------
  const tokens = new WeakMap<HTMLElement, number>();
  const countReset = (el: HTMLElement) => {
    // остановить счёт и вернуть итоговое значение (оно же — SEO-текст)
    tokens.set(el, (tokens.get(el) ?? 0) + 1);
    if (el.dataset.orig !== undefined) el.textContent = el.dataset.orig;
    el.classList.remove('is-counting');
    el.style.minWidth = '';
  };
  const countUp = (el: HTMLElement) => {
    countReset(el);
    const txt = (el.dataset.orig ??= el.textContent ?? '');
    const tok = tokens.get(el);
    const m = txt.match(/\d[\d\s  ]*\d|\d/);
    const target = Number(el.dataset.price);
    if (!m || !target || Number(m[0].replace(/\D/g, '')) !== target) return;
    const pre = txt.slice(0, m.index), post = txt.slice(m.index! + m[0].length);
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    el.classList.add('is-counting');
    const t0 = performance.now(), dur = 900;
    const step = (t: number) => {
      if (tokens.get(el) !== tok) return;
      const p = Math.min(1, (t - t0) / dur);
      const v = Math.round(target * (1 - (1 - p) ** 3));
      el.textContent = p < 1 ? pre + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + post : txt;
      if (p < 1) requestAnimationFrame(step);
      else { el.classList.remove('is-counting'); el.style.minWidth = ''; }
    };
    requestAnimationFrame(step);
  };

  // ---------- Scroll-reveal со stagger ----------
  const R = '.section>h2,.section>p,.cards>*,.trial-banner,.steps>li,.faq__item,.first-visit>h2,.reviews>h2,.faq>h2,.lead>h2,.lead-form,.lead-fallback,.price-group__title,.cta-band .container,.package-steps>li,.package-items>li,.ribbon';
  // Анимация проигрывается КАЖДЫЙ раз, когда блок снова входит в экран:
  // io — запускает (с отступом снизу), reset — сбрасывает, когда блок полностью ушёл с экрана.
  const prices = (el: HTMLElement) => (el.matches('.price[data-price]') ? [el] : $$('.price[data-price]', el));
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      if (el.classList.contains('in')) continue;
      el.style.setProperty('--d', `${Math.min(n++, 6) * 80}ms`);
      el.classList.add('in');
      for (const p of prices(el)) setTimeout(() => el.classList.contains('in') && countUp(p), 250 + n * 80);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  const reset = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.classList.remove('in');
      for (const p of prices(el)) countReset(p);
    }
  });
  $$(R).forEach((el) => {
    el.dataset.reveal = '';
    const bounds = el.getBoundingClientRect();
    if (bounds.top < innerHeight && bounds.bottom > 0) el.classList.add('in');
    io.observe(el); reset.observe(el);
  });

  // Вход hero тоже повторяется: ушёл с экрана → .is-off снимает анимацию → вернулся → играет заново.
  const heroEl = document.querySelector<HTMLElement>('.hero');
  if (heroEl) {
    new IntersectionObserver(([e]) => heroEl.classList.toggle('is-off', !e.isIntersecting)).observe(heroEl);
  }

  // ---------- Ротатор процедур: размытие → печать с кареткой ----------
  for (const rot of $$('[data-rot]')) {
    const t = rot.querySelector<HTMLElement>('.rot__t');
    const list = (rot.dataset.rot ?? '').split('|');
    if (!t || list.length < 2) continue;
    let i = 0;
    const type = (s: string, k = 0) => {
      t.textContent = s.slice(0, k);
      if (k < s.length) setTimeout(() => type(s, k + 1), 55);
      else setTimeout(next, 2400);
    };
    const next = () => {
      if (document.hidden) return void setTimeout(next, 1000);
      t.classList.add('is-out');
      setTimeout(() => { t.classList.remove('is-out'); type(list[(i = (i + 1) % list.length)]); }, 320);
    };
    setTimeout(next, 2600);
  }

  // ---------- Шапка: прячется вниз / появляется вверх; прогресс скролла ----------
  const header = document.querySelector<HTMLElement>('.site-header');
  const heroMedia = document.querySelector<HTMLElement>('.hero__media');
  const bar = document.querySelector<HTMLElement>('.scroll-progress');
  const cssProgress = CSS.supports('animation-timeline: scroll()');
  let lastY = scrollY, ticking = false;
  on(window, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      if (header) {
        const busy = header.matches(':focus-within') || !!header.querySelector('details[open]');
        if (y > lastY + 6 && y > 240 && !busy) header.classList.add('is-hidden');
        else if (y < lastY - 6 || y < 120) header.classList.remove('is-hidden');
      }
      if (heroMedia && y < 900) heroMedia.style.setProperty('--sy', `${(y * 0.06).toFixed(1)}px`);
      if (bar && !cssProgress) bar.style.setProperty('--sp', String(y / Math.max(1, root.scrollHeight - innerHeight)));
      lastY = y;
      ticking = false;
    });
  });

  if (finePointer) {
    // ---------- Параллакс фигуры в hero ----------
    const media = document.querySelector<HTMLElement>('.hero__media');
    const hero = media?.closest<HTMLElement>('.hero');
    if (media && hero) {
      on(hero, 'pointermove', (e) => {
        const r = hero.getBoundingClientRect(), pe = e as PointerEvent;
        media.style.setProperty('--px', `${(((pe.clientX - r.left) / r.width - 0.5) * -14).toFixed(1)}px`);
        media.style.setProperty('--py', `${(((pe.clientY - r.top) / r.height - 0.5) * -10).toFixed(1)}px`);
      });
      on(hero, 'pointerleave', () => { media.style.removeProperty('--px'); media.style.removeProperty('--py'); });
    }
  }
}
