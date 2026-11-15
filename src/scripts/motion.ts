/**
 * Движение сайта: reveal, count-up цен, лента процедур, ротатор, шапка, магнитные кнопки, ripple, tilt, параллакс.
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
  $$(R).forEach((el) => { io.observe(el); reset.observe(el); });

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

  // ---------- Лента процедур: бесконечная 3D-карусель ----------
  for (const track of $$('[data-ribbon]')) {
    const items = [...track.children] as HTMLElement[];
    let nat: number[] = [], W = 0, step = 0, w = 0, vw = 0, off = NaN, v = 0, target = small ? 26 : 38;
    let visible = false, raf = 0, last = 0;
    const measure = () => {
      const cs = getComputedStyle(track);
      items.forEach((it) => (it.style.transform = ''));
      nat = items.map((it) => it.offsetLeft);
      w = items[0].offsetWidth;
      step = w + parseFloat(cs.columnGap || '0');
      W = step * items.length;
      vw = track.clientWidth;
      if (off !== off) off = -step; // первый кадр совпадает с исходной раскладкой
    };
    const render = () => {
      for (let k = 0; k < items.length; k++) {
        const x = ((((nat[k] - off) % W) + W) % W) - step;
        const d = Math.max(-1.2, Math.min(1.2, (x + w / 2 - vw / 2) / (vw / 2)));
        const a = Math.abs(d), it = items[k];
        it.style.transform = `translateX(${(x - nat[k]).toFixed(1)}px) rotateY(${(-d * (small ? 18 : 30)).toFixed(1)}deg) scale(${(1 - 0.16 * d * d).toFixed(3)})`;
        // прозрачность у краёв не ниже .75 — подписи плиток сохраняют контраст ≥ 4.5:1
        it.style.opacity = Math.max(0.75, 1 - 0.35 * Math.max(0, a - 0.35)).toFixed(2);
        if (!small) it.style.filter = a > 0.5 ? `blur(${((a - 0.5) * 7).toFixed(1)}px)` : '';
      }
    };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000 || 0);
      last = t;
      v += (target - v) * Math.min(1, dt * 4);
      off += v * dt;
      render();
      raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    };
    const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    measure();
    render();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(track);
    on(document, 'visibilitychange', start);
    on(window, 'resize', () => { measure(); render(); });
    const pause = (p: boolean) => () => (target = p ? 0 : small ? 26 : 38);
    on(track, 'pointerenter', pause(true));
    on(track, 'pointerleave', pause(false));
    on(track, 'focusin', (e) => {
      pause(true)();
      const k = items.findIndex((it) => it.contains(e.target as Node));
      if (k >= 0) { off = nat[k] - (vw - w) / 2 - step; render(); }
    });
    on(track, 'focusout', pause(false));
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

  // ---------- Ripple на кнопках ----------
  on(document, 'pointerdown', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('.btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect(), pe = e as PointerEvent;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `left:${pe.clientX - r.left}px;top:${pe.clientY - r.top}px;--rs:${(Math.max(r.width, r.height) * 2.4) / 16}`;
    btn.append(s);
    on(s, 'animationend', () => s.remove());
  });

  if (finePointer) {
    // ---------- Магнитные главные CTA ----------
    for (const b of $$('.hero .btn--primary, .cta-band .btn--primary, .site-header .btn--primary, [data-magnetic]')) {
      on(b, 'pointermove', (e) => {
        const r = b.getBoundingClientRect(), pe = e as PointerEvent;
        b.style.setProperty('--mx', `${((pe.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
        b.style.setProperty('--my', `${((pe.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
      });
      on(b, 'pointerleave', () => { b.style.removeProperty('--mx'); b.style.removeProperty('--my'); });
    }

    // ---------- Tilt карточек ----------
    on(document, 'pointermove', (e) => {
      const pe = e as PointerEvent;
      const c = (pe.target as Element).closest?.<HTMLElement>('.card:not(.trial-banner)');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', `${(((pe.clientX - r.left) / r.width - 0.5) * 5).toFixed(2)}deg`);
      c.style.setProperty('--rx', `${((0.5 - (pe.clientY - r.top) / r.height) * 5).toFixed(2)}deg`);
    });
    on(document, 'pointerout', (e) => {
      const c = (e.target as Element).closest?.<HTMLElement>('.card');
      const to = (e as PointerEvent).relatedTarget as Node | null;
      if (c && !(to && c.contains(to))) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); }
    });

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
