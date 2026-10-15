# Doğrulama — 15 Ekim 2026

Hedef: https://yapimalzemecim.com.tr; telefon ve WhatsApp +90 544 330 80 46. GitHub/Coolify için Dockerfile ve Node.js24/SQLite çalışma yolu hazırlandı. Sites Vinext/D1 yolu da korunur.

## Lighthouse — standalone Node önizlemesi

4176 portundaki üretim Node sunucusunda mobil 390×844 benzetimiyle çalıştırıldı. Gerçek internet alan adı veya Coolify sunucusu ölçümü değildir.

| Sayfa | Performans | Erişilebilirlik | İyi uygulamalar | SEO |
|---|---:|---:|---:|---:|
| Ana sayfa | 98 | 100 | 100 | 100 |
| Filmli plywood | 99 | 100 | 100 | 100 |
| OSB/3 rehberi | 100 | 100 | 100 | 100 |
| Teklif | 100 | 100 | 100 | 100 |

Bu dört sayfada CLS0, TBT0ms; LCP sırasıyla 2,4 / 1,8 / 1,4 / 1,4 saniye. İlk istemci JavaScript paketi yaklaşık10KB; GSAP ihtiyaç olan sayfalarda ilk ekrandan sonra yüklenir.

**17/17 indekslenebilir sayfa ayrıca Lighthouse SEO100/100 aldı.** Bu teknik test puanıdır; sıralama veya indeksleme garantisi değildir.

## İşlev ve veri

- 19HTML × iki viewport: **38/38 sayfa kontrolü geçti**.
- **33/33 UI etkileşimi** ve **3/3 regresyon** geçti. UI gönderim yanıtları stub edilir; veri kaydı ayrıca gerçek sunucuda sınanır.
- **7/7 standalone Node/SQLite testi**: anonim form gönderimi, doğrulama, imza, idempotency, yönetim anahtarı, CSV/durum, hız sınırı, migration rollback, yeniden başlatmada kalıcılık, gzip/HEAD/yönlendirme/404, runtime SEO alan adı.
- **7/7 Sites Worker/D1 API testi**: ayrı yerel runtime üzerinde gerçek kayıt ve ChatGPT+anahtar yetkilendirmesi.
- Gerçek Node tarayıcı entegrasyonu: formdan talep kaydı, talep numarası, ChatGPT gerektirmeyen yönetim ekranında kaydın görünmesi geçti.
- Statik SEO/bağlantı denetimi ve TypeScript kontrolü geçti. Konsol, istek, HTTP, taşma ve kırık görsel hatası yok.
- Gizli anahtarlar ve yerel müşteri/test kayıtları Git ve Docker bağlamından dışlandı; içerik taramasıyla kontrol edildi.

Raporlar yerel output/ klasöründedir. Node ve API testleri yalnız loopback ve geçici/yerel veritabanına yazılır; bu kayıtlar üretime taşınmaz.

## Dağıtım kapsamı

Docker imajı bu bilgisayarda çalıştırılmadı; Docker motoru açık değildi. Dockerfile'ın kullandığı frontend build ve aynı standalone Node sunucusunun işlevleri yerelde doğrulandı. Coolify, Dockerfile üzerinden3000portunda çalıştırmalı ve /app/data için kalıcıvolume kullanmalıdır. Tüm ayarlar COOLIFY.md içindedir.

Gerçek ticari unvan, adres, hizmet bölgeleri ve işletmeye özgü aydınlatma metni henüz sağlanmadı. Bunlar uydurulmadı. Site telefon/WhatsApp ve kalıcı talep formu üzerinden iletişim sağlar.
