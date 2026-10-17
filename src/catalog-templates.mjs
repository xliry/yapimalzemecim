import { productMedia, photoWidths } from './product-media.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const expand = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const photoUrl = name => `/assets/${name}-${photoWidths(name).at(-1)}.webp`;

export function catalogPhoto(name, { eager = false, sizes = '(max-width:760px) calc(100vw - 40px), 45vw', card = false, thumbnail = false } = {}) {
  const media = productMedia[name];
  if (!media) throw new Error(`Unknown catalog photo: ${name}`);
  const widths = thumbnail ? [photoWidths(name)[0]] : photoWidths(name);
  const srcset = format => widths.map(width => `/assets/${name}-${width}.${format} ${width}w`).join(', ');
  const position = card ? media.cardPosition : media.position;
  return `<picture><source type="image/avif" srcset="${srcset('avif')}" sizes="${sizes}"><img src="/assets/${name}-${widths.at(-1)}.webp" srcset="${srcset('webp')}" sizes="${sizes}" alt="${esc(media.alt)}" width="${media.width}" height="${media.height}" style="object-position:${position}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

export function productFilters(products) {
  const groups = [['all', 'Tüm ürünler'], ['kalip', 'Kalıp çözümleri'], ['panel', 'Ahşap paneller'], ['kereste', 'Kereste']];
  return `<div class="product-filters" aria-label="Ürünleri filtrele">${groups.map(([group, title], index) => `<button class="${index === 0 ? 'active' : ''}" data-filter="${group}" aria-pressed="${index === 0}">${title} <span>${String(group === 'all' ? products.length : products.filter(p => p.group === group).length).padStart(2, '0')}</span></button>`).join('')}</div>`;
}

export function productGallery(product) {
  const images = product.gallery || [product.image];
  return `<div class="product-gallery" data-product-gallery aria-label="${esc(product.title)} fotoğrafları">
    <div class="product-stage">${images.map((name, index) => `<div class="product-frame ${index === 0 ? 'is-active' : ''}" data-product-frame="${index}" ${index === 0 ? '' : 'hidden'}>${index === 0 ? catalogPhoto(name, { eager: true }) : `<template>${catalogPhoto(name)}</template>`}</div>`).join('')}
      <a class="product-zoom" data-product-zoom href="${photoUrl(images[0])}" target="_blank" rel="noopener" aria-label="Büyük görüntüle: ${esc(product.title)} fotoğrafı">${expand}<span>Büyük görüntüle</span></a>
    </div>
    <div class="product-gallery-meta"><span>ÜRÜN / DETAY / UYGULAMA</span><span data-product-count>01 / ${String(images.length).padStart(2, '0')}</span></div>
    <div class="product-thumbnails" role="group" aria-label="Ürün fotoğrafını seçin">${images.map((name, index) => `<button data-product-select="${index}" data-full="${photoUrl(name)}" data-alt="${esc(productMedia[name].alt)}" aria-label="${String(index + 1).padStart(2, '0')}. fotoğraf: ${esc(productMedia[name].alt)}" aria-pressed="${index === 0}">${catalogPhoto(name, { thumbnail: true, sizes: '76px' })}<span class="photo-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></button>`).join('')}</div>
    <p class="product-photo-caption" data-product-caption aria-live="polite">${esc(productMedia[images[0]].alt)}</p>
    <dialog class="product-dialog" data-product-dialog aria-label="${esc(product.title)} büyük fotoğraf"><button class="product-dialog-close" data-product-close aria-label="Büyük fotoğrafı kapat" autofocus>×</button><img data-product-full alt=""><p data-product-full-caption></p></dialog>
  </div>`;
}

export function materialStudy() {
  return `<section class="material-lab" id="detay"><div class="wrap lab-grid"><div class="lab-visual lab-photography">
    <div class="material-frame" data-material-frame="katman">${catalogPhoto('kontrplak-katman')}</div>
    <div class="material-frame" data-material-frame="yuzey" hidden><template>${catalogPhoto('kontrplak-dogal-yuzey')}</template></div>
    <span class="lab-caption" data-material-caption>KATMAN / ÇAPRAZ AHŞAP KAPLAMALAR</span>
    <div class="material-view-control" role="group" aria-label="Kontrplak detayını seçin"><button class="active" data-material-select="katman" aria-pressed="true">Katman</button><button data-material-select="yuzey" aria-pressed="false">Yüzey</button></div>
    </div><div class="lab-copy"><span class="eyebrow"><span class="dot"></span> YAKINDAN BAKIN</span><h2>Malzemeyi<br><em>yakından</em> tanıyın.</h2><p>Yüzeyden kesite, kontrplağın farklı detaylarını inceleyin. Kullanım alanınızı belirleyin, doğru ürünü birlikte seçelim.</p><dl><div><dt>01 / KATMAN</dt><dd>Bir araya gelen ahşap kaplamalar</dd></div><div><dt>02 / YÜZEY</dt><dd>İşlenecek ve görünecek yüzü birlikte değerlendirin</dd></div><div><dt>03 / SEÇİM</dt><dd>Ölçü, kullanım ortamı ve yüzey beklentisi</dd></div></dl><a class="text-link" href="/urunler/kontrplak/">Kontrplak ürününü inceleyin <span aria-hidden="true">↗</span></a></div></div></section>`;
}

export function depotSection() {
  return `<section class="section depot-section"><div class="wrap depot-layout"><div class="depot-photo">${catalogPhoto('ahsap-urun-deposu', { sizes: '(max-width:760px) calc(100vw - 40px), 58vw' })}<span>AHŞAP ÜRÜNLERİ / TEDARİK</span></div><div class="depot-copy"><span class="eyebrow"><span class="dot"></span> ÜRÜNDEN TESLİMATA</span><h2>İhtiyaç belli.<br>Plan net.</h2><p>Levha, kereste veya kalıp kirişi. Ürün seçimini miktar, teslimat yeri ve kullanım koşullarıyla birlikte ele alıyoruz.</p><ul><li>Ürün ve ölçülerin netleştirilmesi</li><li>Miktara göre teklif hazırlanması</li><li>Teslimat ve indirme koşullarının planlanması</li></ul><a class="text-link" href="/teklif/">İhtiyacınızı paylaşın <span aria-hidden="true">↗</span></a></div></div></section>`;
}
