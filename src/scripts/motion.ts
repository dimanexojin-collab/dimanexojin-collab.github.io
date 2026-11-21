export {};
/** One visibility controller owns replay; content is never hidden while waiting. */
const root = document.documentElement;
(window as unknown as { __km: number }).__km = 1;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const selector = '.section>h2,.section>p,.section-intro,.cards>*,.trial-banner,.steps>li,.faq__item,.first-visit>h2,.reviews>h2,.faq>h2,.lead>h2,.lead-form,.lead-fallback,.price-group__title,.price-tabs__filters,.cta-band .container,.package-steps>li,.package-items>li';
const elements = [...document.querySelectorAll<HTMLElement>(selector)];
const inside = new Set<HTMLElement>();
const running = new Map<HTMLElement, Animation[]>();
const stop = (el: HTMLElement) => {
  running.get(el)?.forEach((a) => a.cancel());
  running.delete(el);
};
const isVisible = (el: HTMLElement) => {
  if (el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
};
const play = (el: HTMLElement, order = 0) => {
  stop(el);
  el.classList.add('in');
  if (reduced.matches) return;
  // The observed box only fades. Moving that box caused observer-boundary flicker.
  const delay = Math.min(order, 4) * 45;
  const animations = [el.animate([{ opacity: .48 }, { opacity: 1 }], {
    duration: 480, delay, easing: 'ease-out', fill: 'backwards',
  })];
  const children = el.matches('.card,.steps__item,.price-tabs__filters')
    ? [...el.children].filter((e): e is HTMLElement => e instanceof HTMLElement && !e.matches('h1,h2,h3,h4,.price-list')) : [];
  const rows = [...el.querySelectorAll<HTMLElement>('.price-row')];
  [...children, ...rows].forEach((child, index) => {
    animations.push(child.animate([
      { opacity: .55, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 440, fill: 'backwards', delay: delay + Math.min(index, 5) * 40, easing: 'cubic-bezier(.22,1,.36,1)' }));
  });
  running.set(el, animations);
  Promise.all(animations.map((a) => a.finished)).then(() => {
    if (running.get(el) === animations) running.delete(el);
  }).catch(() => {});
};
const observer = new IntersectionObserver((entries) => {
  let order = 0;
  for (const entry of entries) {
    const el = entry.target as HTMLElement;
    if (entry.isIntersecting && !el.closest('[hidden]')) {
      if (!inside.has(el)) { inside.add(el); play(el, order++); }
    } else {
      inside.delete(el);
      stop(el);
      el.classList.remove('in');
    }
  }
});
elements.forEach((el) => { el.dataset.reveal = ''; observer.observe(el); });
const replay = (scope: Element = document.body) => {
  let order = 0;
  for (const el of elements) {
    if (!scope.contains(el) && el !== scope) continue;
    // Re-observe after a filter change so stale hidden-panel entries cannot win.
    observer.unobserve(el);
    inside.delete(el);
    stop(el);
    if (isVisible(el)) { inside.add(el); play(el, order++); }
    observer.observe(el);
  }
};
document.addEventListener('kontur:reveal', (event) => {
  const scope = (event as CustomEvent<{ scope: Element }>).detail?.scope;
  if (scope) replay(scope);
});
window.addEventListener('pageshow', (event) => { if (event.persisted) replay(); });
reduced.addEventListener('change', () => {
  if (reduced.matches) for (const el of running.keys()) stop(el);
  else replay();
});

// Desktop header stays steady; the mobile header scrolls away with the document.
const bar = document.querySelector<HTMLElement>('.scroll-progress');
if (bar && !CSS.supports('animation-timeline: scroll()')) {
  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      bar.style.setProperty('--sp', String(scrollY / Math.max(1, root.scrollHeight - innerHeight)));
      scheduled = false;
    });
  }, { passive: true });
}
