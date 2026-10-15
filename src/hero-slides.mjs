export const heroSlides = [
  { name: 'hero-truck', title: 'Malzemeden projeye', alt: 'Ahşap ürünleri deposunda Yapı Malzemecim markalı tır', width: 2752, height: 1536, position: '65% 54%', mobilePosition: '72% 52%' },
  { name: 'hero-dispatch', title: 'Sevkiyata hazırlık', alt: 'Markalı tırın yanında ahşap levha yükleyen forklift', width: 2752, height: 1536, position: '64% 55%', mobilePosition: '63% 50%' },
  { name: 'hero-warehouse', title: 'Malzemenin yolculuğu', alt: 'Depodaki kontrplak istifleri arasında levha taşıyan forklift ve tır', width: 2752, height: 1536, position: '63% 55%', mobilePosition: '66% 50%' },
  { name: 'hero-forklift', title: 'Her katmanda özen', alt: 'Kontrplak paletinin forkliftle tıra yüklenmesi', width: 2752, height: 1536, position: '66% 51%', mobilePosition: '64% 50%' },
  { name: 'hero-load', title: 'Detaylarıyla planlı', alt: 'Tır üzerindeki ahşap levha paletlerini sabitleyen çalışan', width: 1376, height: 768, position: '64% 50%', mobilePosition: '58% 50%' },
];

export const heroWidths = slide => [960, Math.min(slide.width, 1920)];
export const heroSrcset = (slide, format) => heroWidths(slide).map(width => `/assets/${slide.name}-${width}.${format} ${width}w`).join(', ');
