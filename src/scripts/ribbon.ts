/** The same position control works with the animated ribbon and native reduced-motion scrolling. */
for (const track of document.querySelectorAll<HTMLElement>('[data-ribbon]')) {
  const section = track.closest<HTMLElement>('.ribbon');
  const range = section?.querySelector<HTMLInputElement>('[data-ribbon-position]');
  const controls = section?.querySelector<HTMLElement>('[data-ribbon-controls]');
  const items = [...track.children] as HTMLElement[];
  if (!section || !range || !controls || !items.length) continue;
  controls.hidden = false;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 767px)');
  let animated = false, visible = false, manual = false, hovered = false;
  let nat: number[] = [], width = 0, step = 1, cycle = 1, viewport = 1, off = 0;
  let raf = 0, last = 0;
  let drag: { id: number; x: number; y: number; off: number; moved: boolean } | undefined;
  let suppressClick = false;
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const syncRange = () => {
    const progress = animated
      ? Math.min(1, mod(off + step, cycle) / Math.max(1, cycle - step))
      : track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth);
    range.value = String(Math.round(progress * 1000));
  };
  const render = () => {
    if (!animated) return;
    for (let k = 0; k < items.length; k++) {
      const x = mod(nat[k] - off, cycle) - step;
      const d = Math.max(-1.2, Math.min(1.2, (x + width / 2 - viewport / 2) / (viewport / 2)));
      const a = Math.abs(d), item = items[k];
      item.style.transform = `translateX(${(x - nat[k]).toFixed(1)}px) rotateY(${(-d * (mobile.matches ? 18 : 30)).toFixed(1)}deg) scale(${(1 - 0.16 * d * d).toFixed(3)})`;
      item.style.opacity = Math.max(0.75, 1 - 0.35 * Math.max(0, a - 0.35)).toFixed(2);
      item.style.filter = !mobile.matches && a > 0.5 ? `blur(${((a - 0.5) * 7).toFixed(1)}px)` : '';
    }
    syncRange();
  };
  const tick = (time: number) => {
    const dt = Math.min(0.05, (time - last) / 1000 || 0);
    last = time;
    if (!manual && !hovered && !section.matches(':focus-within')) off += (mobile.matches ? 26 : 38) * dt;
    render();
    raf = animated && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  const start = () => {
    if (!raf && animated && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  const measure = () => {
    const progress = animated ? mod(off + step, cycle) / Math.max(1, cycle - step) : Number(range.value) / 1000;
    cancelAnimationFrame(raf); raf = 0;
    items.forEach((item) => { item.style.transform = ''; item.style.opacity = ''; item.style.filter = ''; });
    track.classList.remove('is-animated');
    animated = !reducedMotion.matches;
    if (animated) {
      track.scrollLeft = 0;
      nat = items.map((item) => item.offsetLeft);
      width = items[0].offsetWidth;
      step = width + parseFloat(getComputedStyle(track).columnGap || '0');
      cycle = step * items.length;
      viewport = track.clientWidth;
      off = Math.min(1, progress) * (cycle - step) - step;
      track.classList.add('is-animated');
      render(); start();
    } else {
      track.scrollLeft = Math.min(1, progress) * Math.max(0, track.scrollWidth - track.clientWidth);
      syncRange();
    }
  };
  const setPosition = () => {
    manual = true;
    if (animated) { off = Number(range.value) / 1000 * (cycle - step) - step; render(); }
    else track.scrollLeft = Number(range.value) / 1000 * Math.max(0, track.scrollWidth - track.clientWidth);
  };
  range.addEventListener('input', setPosition);
  track.addEventListener('scroll', () => { if (!animated) syncRange(); }, { passive: true });
  track.addEventListener('pointerenter', () => { hovered = true; });
  track.addEventListener('pointerleave', () => { hovered = false; });
  track.addEventListener('focusin', (event) => {
    if (!animated) return;
    const index = items.findIndex((item) => item.contains(event.target as Node));
    if (index >= 0) { manual = true; off = nat[index] - (viewport - width) / 2 - step; render(); }
  });
  track.addEventListener('keydown', (event) => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); manual = true;
    if (event.key === 'Home') range.value = '0';
    else if (event.key === 'End') range.value = '1000';
    else range.value = String(Math.max(0, Math.min(1000, Number(range.value) + (event.key === 'ArrowRight' ? 1 : -1) * 1000 / (items.length - 1))));
    setPosition();
  });
  track.addEventListener('dragstart', (event) => event.preventDefault());
  track.addEventListener('pointerdown', (event) => {
    if (!animated || event.button !== 0 || !event.isPrimary) return;
    // A completed swipe cannot leave the next ordinary link tap suppressed.
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, off, moved: false };
  });
  track.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag = undefined; return; }
      if (Math.abs(dx) < 8) return;
      drag.moved = true; manual = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
    }
    off = drag.off - dx; render();
  });
  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick = drag.moved;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    track.classList.remove('is-dragging'); drag = undefined;
  };
  track.addEventListener('pointerup', finishDrag);
  track.addEventListener('pointercancel', finishDrag);
  track.addEventListener('click', (event) => {
    if (suppressClick) { event.preventDefault(); suppressClick = false; }
  }, true);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); }).observe(track);
  new ResizeObserver(measure).observe(track);
  reducedMotion.addEventListener('change', measure);
  document.addEventListener('visibilitychange', start);
  measure();
}

