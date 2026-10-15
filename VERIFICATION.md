# Doğrulama — 15 Ekim 2026

Özel önizleme için yerel `http://127.0.0.1:4173` üzerinde Chromium ve Lighthouse ile çalıştırıldı. Gerçek kullanıcı trafiği veya herkese açık alan adı ölçümü değildir.

## Lighthouse

| Sayfa | Performans | Erişilebilirlik | İyi uygulamalar | SEO |
|---|---:|---:|---:|---:|
| Ana sayfa | 91 | 100 | 100 | 100 |
| Filmli plywood | 96 | 100 | 100 | 100 |
| OSB/3 rehberi | 97 | 100 | 100 | 100 |
| Teklif hazırlama | 98 | 100 | 100 | 100 |

Mobil benzetimi: 390 × 844. Bu dört sayfada CLS 0, Total Blocking Time 0 ms. LCP sırasıyla 3,3 / 2,6 / 2,3 / 2,1 saniye. Performans cihaz, ağ ve barındırmaya göre değişir.

**İndekslenebilir 17 sayfanın tamamı ayrıca Lighthouse SEO denetiminden 100/100 aldı.** Ayrıntılı raporlar: `output/lighthouse-seo/summary.json`, sayfa başına JSON ve HTML. Bu puan arama sıralaması veya indeksleme garantisi değildir.

## İşlev ve responsive

- 18 HTML sayfası × mobil/masaüstü = 36 sayfa kontrolü.
- 31 etkileşim testi: mobil menü/Escape, ürün filtreleri, hesaplayıcı, kalınlık etkileşimi, form parametreleri ve doğrulama, dosya indirme, gerçek clipboard ve izin reddi, çerez tercihleri, azaltılmış hareket tercihi.
- Başarısız test, yatay taşma, kırık görsel, konsol hatası, istek hatası veya HTTP hatası: **0**.
- 1543 statik kontrol: sayfa başlıkları, açıklamalar, tek H1, canonical, JSON-LD, tüm iç bağlantılar/fragmentler/görseller/fontlar, sitemap, robots ve LLM dosyaları. Hata: **0**.
- Üretim bağımlılıkları için npm audit: **0 bilinen açık**. Geliştirme araçları dağıtım çıktısına dahil edilmez.

Raporlar `output/functional-qa.json`, `output/static-check.json`, `output/lighthouse/` ve `output/lighthouse-seo/` içinde saklanır. Yeniden üretme komutları README'dedir.

## Kalan işletme girdileri

Telefon/WhatsApp, ticari unvan, adres, gerçek hizmet bölgeleri, alan adı ve gerçek ürün/teslimat koşulları henüz sağlanmadı. Site özel inceleme sürümüdür. Mevcut form talep dosyası oluşturur; otomatik satış başvurusu göndermez. Gerçek iletişim bilgileri `site.config.mjs` içinde doldurulunca ilgili telefon/WhatsApp/e-posta bağlantıları etkinleşir.

Takip kimlikleri tanımlı değildir; Google/Meta betikleri yüklenmez. Özet hazırlama olayı gerçek lead/satış dönüşümü olarak sunulmaz. Yapay zekâ görselleri temsilî olarak belirtilmiştir.
