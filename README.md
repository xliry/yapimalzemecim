# Yapı Malzemecim

**Coolify kurulumu:** [COOLIFY.md](COOLIFY.md). Hedef alan adı https://yapimalzemecim.com.tr; telefon/WhatsApp +90 544 330 80 46. Dockerfile, Node.js24 ve kalıcı SQLite sürümü hazırdır.

Türkçe plywood ve yapı malzemeleri sitesi. 17 içerik sayfası, dört ürün ailesi, altı kaynaklı rehber, GSAP animasyonları, levha hesaplayıcı ve kalıcı teklif talebi sistemi.

## Çalıştırma

Node.js 22.13 veya üzeri gerekir.

```sh
npm install
npm run build
npm run dev
```

Önizleme http://127.0.0.1:4173 üzerindedir. Vinext/Cloudflare geliştirme ortamı, loopback isteklerinde Sites'ın sağladığı ChatGPT oturum benzetimini kullanır. Üretimde kimlik Sites tarafından sağlanır. İlk kurulumda migration uygulanır:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_melodic_havok.sql
```

Bu bilgisayardaki npm kabuk sarmalayıcısının yol sorunu için doğrudan `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" install` kullanılabilir.

## İçerik ve görsel tasarım

- `site.config.mjs`: marka, canonical alan adı, telefon/WhatsApp/e-posta ve reklam kimlikleri.
- `src/content.mjs`: dört ürün, altı makale, SSS ve resmi teknik kaynaklar.
- `src/templates.mjs`, `src/style.css`: HTML ve responsive tasarım.
- `src/client.js`, `src/motion.js`: etkileşimler ve ilk ekrandan sonra yüklenen GSAP.
- `src/quote-client.js`: doğrulama, gerçek gönderim, başarısız gönderimi yeniden deneme, özet indirme/kopyalama.
- `public/assets/`: özgün fotoğraf kaynakları ve yerel Manrope fontu. Son üretim promptları `image-prompts-hero.md` ve `image-prompts-products.md` içindedir.

Build önce taranabilir HTML'yi `generated/ssg/` altında üretir. Vinext route handler bu HTML'yi aynı içerikle sunar; optimize statik varlıklar `dist/client`, Worker `dist/server` içinde hazırlanır. Kaynak PNG'ler dağıtılmaz. JSON-LD, canonical, sitemap, robots, llms.txt ve llms-full.txt build sırasında üretilir.

## Teklif talepleri

Gönderilen talepler Cloudflare D1 içinde kalıcı saklanır. POST işleminde sunucu doğrulaması, kısa süreli imzalı form belirteci, aynı kaydın yanlışlıkla tekrar oluşmasını engelleyen talep kimliği ve gönderim sınırı uygulanır. Başarı mesajı yalnızca sunucunun kayıt onayından sonra gösterilir. Ağ hatasında özet indirilebilir ve aynı talep kimliğiyle yeniden gönderilebilir.

Yerel test verileri `.wrangler/state` içindedir ve yayına taşınmaz. Üretim migration'larını Sites uygular. Şema değişince `npm run db:generate` ile yeni migration üretilir; uygulanmış SQL değiştirilmez.

## Talep yönetimi

`/yonetim/` adresi arama indeksine ve sitemap'e dahil değildir. Liste, durum değiştirme ve CSV indirme API'leri hem ChatGPT oturumu hem yönetim anahtarı gerektirir. Anahtar tarayıcıda yalnızca sekme belleğinde tutulur. Yönetim sayfası hiçbir talep verisini HTML veya genel JavaScript içine gömmez.

Bu bilgisayardaki yönetim erişim bilgisi `output/yonetim-erisim.txt` içindedir; Git'e ve yayın paketine eklenmez. Yerel anahtarlar `.dev.vars` içindedir. Üretim anahtarları Sites ortamında secret olarak tanımlıdır: `FORM_SIGNING_KEY`, `ADMIN_ACCESS_KEY`. Anahtarları kaynak koduna, URL'ye veya istemci paketine eklemeyin.

Telefon/WhatsApp +90 544 330 80 46 olarak tanımlıdır; telefon, WhatsApp ve form üzerinden erişim sağlanır. Diğer firma bilgileri doğrulanmadan eklenmez. Ticari faaliyetten önce işletme unvanı, adresi, gerçek hizmet bölgeleri, ürün föyleri ve işletmeye özgü aydınlatma bilgileri tamamlanmalıdır.

## Reklam ölçümü

Google/Meta kimlikleri başlangıçta boştur; takip kodları yüklenmez. Kimlikler girilirse analiz/reklam kodları yalnızca izin sonrasında yüklenir. Kişisel bilgi içermeyen `quote_prepared`, `quote_submitted`, `contact_click`, `material_explore` olayları dataLayer'a yazılır. Meta Lead yalnızca başarılı kayıt sonrasında tetiklenir. Reklam hesaplarının gerçek dönüşüm eşleştirmesi kendi ölçüm kurulumunda tanımlanmalıdır.

## Doğrulama

```sh
npm run check
node node_modules/typescript/bin/tsc --noEmit
node scripts/qa.mjs
node scripts/test-regressions.mjs
node scripts/test-api.mjs
npm run audit
node scripts/seo-all.mjs
```

UI testleri gönderim yanıtlarını stub ederek arayüz davranışını, API testleri gerçek yerel D1 üzerinde kayıt ve yetkilendirmeyi sınar. API testleri yalnız loopback'e kayıt yazar; yerel yönetim anahtarı ortamdan verilirse yetkili lifecycle testleri de çalışır. `CHROME_PATH`, `QA_ORIGIN`, `SEO_ORIGIN`, `AUDIT_ORIGIN` ile ortam seçilebilir. Raporlar `output/` altına yazılır.

Son doğrulama ve ölçüm kapsamı `VERIFICATION.md` içindedir. Lighthouse puanı teknik denetim sonucudur; sıralama veya indeksleme garantisi değildir. Yayın mevcut özel Sites erişimini korur.
