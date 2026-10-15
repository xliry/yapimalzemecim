export function initHeroGallery() {
  const hero = document.querySelector('[data-hero-gallery]');
  if (!hero) return;
  const slides = [...hero.querySelectorAll('[data-hero-slide]')];
  const controls = hero.querySelector('[data-gallery-controls]');
  const buttons = [...hero.querySelectorAll('[data-gallery-select]')];
  const pause = hero.querySelector('[data-gallery-pause]');
  const caption = hero.querySelector('[data-gallery-caption]');
  const status = hero.querySelector('[data-gallery-status]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Map();
  let active = 0, serial = 0, timer, userPaused = false, hovered = false, focused = false, inView = false;
  const canPlay = () => !motion.matches && !userPaused && !hovered && !focused && inView && !document.hidden;
  const schedule = () => {
    clearTimeout(timer);
    if (canPlay()) timer = setTimeout(() => show((active + 1) % slides.length, false), 7000);
  };
  const syncPause = () => {
    pause.hidden = motion.matches;
    pause.setAttribute('aria-label', userPaused ? 'Otomatik geçişleri başlat' : 'Otomatik geçişleri durdur');
    pause.setAttribute('aria-pressed', String(userPaused));
    pause.dataset.paused = String(userPaused);
    schedule();
  };
  const load = index => {
    if (!pending.has(index)) pending.set(index, (async () => {
      const slide = slides[index];
      const template = slide.querySelector('template');
      if (template) {
        slide.append(template.content.cloneNode(true));
        template.remove();
      }
      const image = slide.querySelector('img');
      try { await image.decode(); return image.naturalWidth > 0; }
      catch { pending.delete(index); return false; }
    })());
    return pending.get(index);
  };
  async function show(index, manual = true) {
    const request = ++serial;
    clearTimeout(timer);
    if (index === active) { schedule(); return; }
    const loaded = await load(index);
    if (request !== serial) return;
    if (!loaded) {
      if (manual) status.textContent = 'Görsel yüklenemedi. Başka bir kare seçebilirsiniz.';
      schedule(); return;
    }
    if (!manual && !canPlay()) { schedule(); return; }
    active = index;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === active);
      slide.setAttribute('aria-hidden', String(i !== active));
    });
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
    caption.textContent = slides[index].dataset.caption;
    if (manual) status.textContent = `${index + 1} / ${slides.length}: ${slides[index].dataset.caption}`;
    schedule();
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => show(index)));
  controls.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !event.target.matches('[data-gallery-select]')) return;
    event.preventDefault();
    const current = buttons.indexOf(event.target);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length;
    buttons[index].focus(); show(index);
  });
  pause.addEventListener('click', () => { userPaused = !userPaused; syncPause(); });
  hero.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
  hero.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  hero.addEventListener('focusin', () => { focused = true; schedule(); });
  hero.addEventListener('focusout', () => queueMicrotask(() => { focused = hero.contains(document.activeElement); schedule(); }));
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', syncPause);
  new IntersectionObserver(entries => { inView = entries[0].intersectionRatio >= .25; schedule(); }, { threshold: .25 }).observe(hero);
  controls.hidden = false;
  syncPause();
}
