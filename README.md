# Yapı Malzemecim

Plywood, kontrplak, OSB ve kereste için Türkçe kurumsal tanıtım ve talep hazırlama sitesi. 17 statik sayfa, 4 ürün ailesi, 6 kaynaklı rehber, GSAP/ScrollTrigger hareketleri, yaklaşık levha hesaplayıcı ve talep dosyası aracı.

## Geliştirme

Node.js 22 veya üzeri gerektirir.

```sh
npm install
npm run build
npm run dev
```

Yerel önizleme: http://127.0.0.1:4173

Bu bilgisayarda npm kabuk sarmalayıcısı hatalı yol çözüyorsa doğrudan `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" install` kullanılabilir.

## Düzenleme

- `site.config.mjs`: marka, site adresi, telefon, WhatsApp, e-posta, adres ve takip kimlikleri.
- `src/content.mjs`: ürün özellikleri, makaleler, SSS ve resmi teknik kaynaklar.
- `src/templates.mjs`: sayfa şablonları ve meta verileri.
- `src/style.css`: görsel tasarım ve responsive düzen.
- `src/client.js`: GSAP, filtreler, hesaplayıcı, teklif ve çerez tercihleri.
- `public/assets/`: özgün fotoğraf kaynakları ve yerel Manrope fontu. Görsel promptları ayrı Markdown dosyalarında kayıtlıdır.

## Doğrulama

```sh
npm run check
node scripts/qa.mjs
npm run audit
node scripts/seo-all.mjs
```

Tarayıcı araçlarında `CHROME_PATH` ortam değişkeniyle mevcut Chrome/Chromium çalıştırılabilir dosyanızı tanımlayın; varsayılan yol bu bilgisayardaki Chromium kurulumudur. QA ve audit, 4173 portundaki yerel siteyi kullanır. Raporlar `output/` klasörüne yazılır.

## İletişimi etkinleştirme

Mevcut sürüm, doğrulanmış işletme bilgileri sağlanana kadar özel önizlemedir. Rakip iletişim bilgisi kullanılmaz.

`site.config.mjs` içindeki `phone`, `whatsapp` (ülke kodu ile rakamlar) ve/veya `email` doldurulup yeniden build alınınca ilgili bağlantılar ve özetin iletişim uygulamasında açılması etkinleşir. Ziyaretçi mesajı o uygulamada gönderir. Formun sunucuya iletimi ve müşteri kayıt sistemi bu statik sürümün kapsamında değildir. Mevcut form, bilgileri sunucuya kaydetmeden okunabilir bir talep dosyası indirir ve metin kopyalar.

Ticari kullanımdan önce işletme unvanı/adresi, gerçek hizmet bölgeleri, ürün föyleri, stok ve teslimat koşulları ile işletmeye özgü KVKK aydınlatması tamamlanmalıdır. Site mevcut haliyle sahte fiyat, stok, sertifika, referans veya teslimat garantisi içermez.

## Google Ads ve Meta

Ürün sayfaları reklam açılış sayfası olarak kullanılabilir. `quote_prepared`, `contact_click` ve `material_explore` olayları `dataLayer` içine kişisel veri içermeyen bağlamla yazılır. `quote_prepared` yalnızca özetin oluşturulmasıdır; sunucuya ulaşmış lead veya tamamlanmış satış sayılmamalıdır.

Google ve Meta kimlikleri başlangıçta boştur; takip kodları yüklenmez. Kimlikler tanımlanırsa çerez tercihi sorulur ve kodlar izin sonrasında yüklenir. Meta `CustomizeProduct` ve `Contact` olayları kullanır. Gerçek reklam dönüşüm eşleştirmesi, işletmenin ölçüm kurulumunda ayrıca tanımlanmalıdır.

## SEO ve dağıtım

Tarayıcıda JavaScript çalışmadan ana içerik HTML'de bulunur. Sayfa bazlı title/description/canonical, Open Graph, Organization/WebSite/Article/FAQ/Breadcrumb JSON-LD, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` ve 404 sayfası build sırasında oluşturulur. Gerçek alan adına geçince `origin` değiştirilip yeniden build alınmalıdır.

Lighthouse SEO puanı, o denetimde geçen teknik kontrolleri ifade eder; Google sıralaması, indeksleme veya satış garantisi değildir. Özel Sites yayını yalnızca sahibinin incelemesi içindir; kamuya açık reklam trafiği için erişim ve gerçek işletme bilgileri tamamlanmalıdır.

`.openai/hosting.json` kayıtlı özel Sites projesini belirtir. Üretim çıktısı `dist/` dizinidir. Kaynak PNG'ler depoda saklanır; dağıtımda optimize WebP/AVIF dosyaları bulunur. Manrope fontu OFL lisansıyla yerel olarak sunulur.
