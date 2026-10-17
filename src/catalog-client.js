function hydrate(frame) {
  const template = frame.querySelector('template');
  if (template) { frame.append(template.content.cloneNode(true)); template.remove(); }
}

export function initCatalog({ track }) {
  document.querySelectorAll('[data-product-gallery]').forEach(gallery => {
    const frames = [...gallery.querySelectorAll('[data-product-frame]')];
    const buttons = [...gallery.querySelectorAll('[data-product-select]')];
    const zoom = gallery.querySelector('[data-product-zoom]');
    const dialog = gallery.querySelector('[data-product-dialog]');
    const full = gallery.querySelector('[data-product-full]');
    const close = gallery.querySelector('[data-product-close]');
    let selected = 0;
    const select = index => {
      selected = index;
      hydrate(frames[index]);
      frames.forEach((frame, i) => { frame.hidden = i !== index; frame.classList.toggle('is-active', i === index); });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      zoom.href = buttons[index].dataset.full;
      gallery.querySelector('[data-product-count]').textContent = `${String(index + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`;
      gallery.querySelector('[data-product-caption]').textContent = buttons[index].dataset.alt;
    };
    buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
    gallery.querySelector('.product-thumbnails').addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (selected + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus(); select(next);
    });
    zoom.addEventListener('click', event => {
      if (!dialog.showModal || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      full.src = zoom.href; full.alt = buttons[selected].dataset.alt;
      gallery.querySelector('[data-product-full-caption]').textContent = full.alt;
      dialog.showModal(); document.body.classList.add('photo-dialog-open');
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { document.body.classList.remove('photo-dialog-open'); zoom.focus({ preventScroll: true }); });
  });
  const lab = document.querySelector('.lab-photography');
  if (!lab) return;
  const captions = { katman: 'KATMAN / ÇAPRAZ AHŞAP KAPLAMALAR', yuzey: 'YÜZEY / DOĞAL AHŞAP DOKUSU' };
  lab.querySelectorAll('[data-material-select]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.materialSelect;
    lab.querySelectorAll('[data-material-select]').forEach(control => { const active = control === button; control.classList.toggle('active', active); control.setAttribute('aria-pressed', String(active)); });
    lab.querySelectorAll('[data-material-frame]').forEach(frame => { const active = frame.dataset.materialFrame === view; if (active) hydrate(frame); frame.hidden = !active; });
    lab.querySelector('[data-material-caption]').textContent = captions[view];
    track('material_explore', { view });
  }));
}
