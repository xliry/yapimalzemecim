const bimsProducts = [20, 24, 25].map(size => {
 const label=`${size}’${size===24?'lük':'lik'}`;
 return ({
  slug: `bims-blok-${size}`,
  title: `${label} Bims Blok`,
  group: 'duvar',
  seoDescription: `${label} bims blok, 9 BB ${size} ürün koduyla. Duvar projeniz için ürün seçimi, miktar ve teslimat bilgilerini inceleyin; ihtiyacınıza özel teklif alın.`,
  short: `${label} duvar uygulamaları için boşluklu bims blok.`,
  tag: 'DUVAR & BİMS',
  image: `bims-blok-${size}`,
  gallery: [`bims-blok-${size}`],
  description: `${label} bims blok, 9 BB ${size} koduyla talep edebileceğiniz boşluklu duvar ürünüdür. Duvar projenizdeki ürün tanımını ve miktarı teslimat bilgileriyle bir araya getirerek teklif hazırlayabilirsiniz. Seçiminizi duvar detayı, blok ölçüsü ve uygulama koşulları üzerinden birlikte netleştirelim.`,
  specs: [
    { label: 'Ürün tipi', value: `${label} bims blok` },
    { label: 'Ürün kodu', value: `9 BB ${size}` },
    { label: 'Yapı', value: 'Boşluklu blok' },
    { label: 'Talep birimi', value: 'Adet veya duvar metrajı' },
  ],
  uses: ['Projede tanımlanan duvar bölümleri', 'Boyutlandırılmış duvar örme işleri', 'Yeni yapı ve tadilat malzeme talepleri'],
  notes: ['Talebinize duvar kalınlığını, yüksekliğini ve toplam alanını ekleyin. Kapı ve pencere boşluklarını ayrıca belirtin.', 'Blokların tam ölçüsü, palet adedi ve teknik değerlerini teklif edilen ürünün bilgileriyle eşleştirin.', 'Şantiye adresi, araç erişimi ve indirme imkânını paylaşarak nakliye kapsamını birlikte planlayın.'],
  faq: [
    { q: `${label} bims blok için nasıl teklif alabilirim?`, a: `9 BB ${size} ürün kodunu, istediğiniz adedi veya duvar metrajını ve teslimat şehrini paylaşın. Termin ve indirme koşullarını da talebinize ekleyebilirsiniz.` },
    { q: '20’lik, 24’lük ve 25’lik bims arasında nasıl seçim yapılır?', a: 'Duvar projesinde belirtilen ürün ve kalınlık esas alınır. Aynı adet farklı ürünlerde aynı duvar alanına karşılık gelmeyebilir; hesapta teklif edilen bloğun tam ölçüsünü kullanın.' },
    { q: 'Palet adedi ve nakliye nasıl hesaplanır?', a: 'Palet içeriği ürünün ambalaj bilgisine göre belirlenir. Toplam adet, teslimat adresi ve araçla indirme koşulları üzerinden nakliye ve sevkiyat planı hazırlanır.' },
  ],
  relatedProducts: [20, 24, 25].filter(other => other !== size).map(other => `bims-blok-${other}`),
}); });

export const masonryProducts = [...bimsProducts, {
  slug: 'delikli-tugla', title: 'Delikli Tuğla', group: 'duvar',
  seoDescription: 'Delikli duvar tuğlasını inceleyin. Duvar kalınlığı, ürün ölçüsü, adet ve teslimat bilgilerinizi paylaşarak yapı projenize özel tuğla teklifi hazırlayın.',
  short: 'Duvar projenize uygun ölçü ve miktarda tuğla talebi.', tag: 'DUVAR & TUĞLA',
  image: 'delikli-tugla', gallery: ['delikli-tugla'],
  description: 'Delikli tuğla, duvar örme işlerinde ürün ölçüsü ve uygulama detayına göre seçilen bir yapı malzemesidir. Projenizde istenen tuğla tipini, duvar kalınlığını ve ihtiyacınızı paylaşın. Ürün tanımı, miktar ve teslimat kapsamını aynı teklifte değerlendirelim.',
  specs: [
    { label: 'Ürün grubu', value: 'Delikli duvar tuğlası' },
    { label: 'Ölçü seçimi', value: 'Duvar projesine göre' },
    { label: 'Talep birimi', value: 'Adet veya duvar metrajı' },
    { label: 'Seçim bilgisi', value: 'Tuğla tipi ve duvar kalınlığı' },
  ],
  uses: ['Projeye uygun iç ve dış duvar işleri', 'Bölme duvar malzeme talepleri', 'Yeni yapı ve tadilat uygulamaları'],
  notes: ['Tuğla ölçüsünü ve delik yönünü sipariş tanımına ekleyin; mevcut projedeki ürün tanımını esas alın.', 'Metraj paylaşırken duvar alanını, açıklıkları ve planlanan fire payını ayrı belirtin.', 'Paletli teslimat, araç erişimi ve indirme koşullarını teklif öncesinde netleştirin.'],
  faq: [
    { q: 'Görseldeki tuğlanın ölçüsü nedir?', a: 'Ölçü seçimi talebinizdeki duvar detayına göre yapılır. İstediğiniz en, boy ve yüksekliği veya projedeki ürün tanımını paylaşarak uygun seçeneği netleştirebilirsiniz.' },
    { q: 'Tuğla ihtiyacımı metrekare olarak paylaşabilir miyim?', a: 'Duvar alanını metrekare olarak paylaşabilirsiniz. Adet hesabı seçilen tuğlanın ölçüsü, derz düzeni, açıklıklar ve fire payına göre tamamlanır.' },
    { q: 'Tuğla ve bims aynı hesapla sipariş edilir mi?', a: 'Ürünlerin boyutları ve uygulama detayları farklı olabilir. Her ürün için adet hesabını kendi ölçü ve duvar detayı üzerinden yapın.' },
  ], relatedProducts: ['bims-blok-20', 'bims-blok-24', 'bims-blok-25'],
}, {
  slug: 'kiremit-cati-aksesuarlari', title: 'Kiremit ve Çatı Aksesuarları', group: 'cati',
  seoDescription: 'Kil, beton ve metal kiremitlerle çatı aksesuarları. Çatınızın ölçülerini, model ve renk tercihinizi paylaşın; kaplama ve aksesuarları birlikte tekliflendirelim.',
  short: 'Kil, beton ve metal kiremit; çatıya uygun aksesuarlar.', tag: 'ÇATI & KAPLAMA',
  image: 'kiremit-cati-aksesuarlari', gallery: ['kiremit-cati-aksesuarlari'],
  options: ['Kil kiremit', 'Beton kiremit', 'Metal kiremit', 'Çatı aksesuarları'],
  description: 'Çatı kaplaması ve tamamlayıcı aksesuarları aynı ihtiyaç listesinde bir araya getirin. Kil, beton veya metal kiremit talebinizi model, renk ve çatı ölçüleriyle paylaşabilirsiniz. Mahya, örtü, bağlantı ve diğer aksesuar ihtiyaçlarını seçilen kaplama sistemiyle birlikte değerlendirelim.',
  specs: [
    { label: 'Ürün seçenekleri', value: 'Kil / beton / metal kiremit' },
    { label: 'Tamamlayıcılar', value: 'Çatı aksesuarları' },
    { label: 'Seçim bilgisi', value: 'Model, renk ve çatı detayı' },
    { label: 'Talep birimi', value: 'Adet veya çatı alanı' },
  ],
  uses: ['Projeye uygun eğimli çatı kaplaması', 'Çatı yenileme ve tamamlama talepleri', 'Kaplama sistemiyle uyumlu aksesuar tedariki'],
  notes: ['Çatının eğimini, yüzey ölçülerini ve planlanan kaplama tipini talebinize ekleyin.', 'Mahya, kenar ve birleşim uzunlukları ile baca gibi özel detayları ayrıca belirtin.', 'Model ve aksesuar uyumunu seçilen üreticinin ürün bilgileri üzerinden değerlendirin.'],
  faq: [
    { q: 'Kil, beton ve metal kiremit için aynı miktar hesabı kullanılır mı?', a: 'Kaplama alanı, bindirme düzeni ve uygulama koşulları modele göre değişir. Adet veya panel hesabı seçilen ürünün teknik bilgileri ve çatı ölçüleriyle yapılır.' },
    { q: 'Çatı aksesuarlarını ayrıca seçebilir miyim?', a: 'Yalnız aksesuar talebi oluşturabilirsiniz. Mevcut kaplamanın marka ve modelini, gereken aksesuarı ve miktarı paylaşmanız uyum kontrolünü kolaylaştırır.' },
    { q: 'Teklif için hangi çatı bilgilerini paylaşmalıyım?', a: 'Çatı alanını, eğimini, kaplama tercihini, model ve rengi, varsa plan veya ölçü listesini ve teslimat adresini paylaşın. Mahya ve kenar detayları aksesuar hesabına ayrıca eklenir.' },
  ], relatedProducts: ['osb', 'kereste'],
}];
