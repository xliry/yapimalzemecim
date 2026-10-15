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
  let active = 0, serial = 0, timer, userPaused = motion.matches, inView = false;
  const canPlay = () => !userPaused && inView && !document.hidden;
  const schedule = () => {
    clearTimeout(timer);
    if (canPlay()) timer = setTimeout(() => show((active + 1) % slides.length, false), 5000);
  };
  const syncPause = () => {
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
      return new Promise(resolve => {
        let settled = false;
        const timeout = setTimeout(() => finish(false), 8000);
        function finish(loaded) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (!loaded) pending.delete(index);
          resolve(loaded);
        }
        image.decode().then(() => finish(image.naturalWidth > 0), () => finish(false));
      });
    })());
    return pending.get(index);
  };
  async function show(index, manual = true) {
    const request = ++serial;
    clearTimeout(timer);
    if (index === active) { schedule(); return; }
    let loaded = false;
    for (let attempt = 0; attempt < slides.length - 1; attempt++) {
      loaded = await load(index);
      if (request !== serial) return;
      if (!manual && !canPlay()) { schedule(); return; }
      if (loaded) break;
      if (manual) {
        status.textContent = 'Görsel yüklenemedi. Başka bir kare seçebilirsiniz.';
        schedule(); return;
      }
      index = (index + 1) % slides.length;
      if (index === active) break;
    }
    if (!loaded) { schedule(); return; }
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
    userPaused = true;
    syncPause();
    const current = buttons.indexOf(event.target);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length;
    buttons[index].focus(); show(index);
  });
  pause.addEventListener('click', () => { userPaused = !userPaused; syncPause(); });
  hero.addEventListener('focusin', event => {
    // Keyboard navigation pauses rotation; pointer selection keeps the gallery playing.
    if (event.target !== pause && event.target.matches(':focus-visible')) {
      userPaused = true;
      syncPause();
    }
  });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => {
    // Reduced motion starts paused, with a visible Play control for explicit opt-in.
    if (motion.matches) userPaused = true;
    syncPause();
  });
  new IntersectionObserver(entries => { inView = entries[0].intersectionRatio >= .25; schedule(); }, { threshold: .25 }).observe(hero);
  controls.hidden = false;
  syncPause();
}
