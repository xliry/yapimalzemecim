# Coolify kurulumu

Bu depo Coolify üzerinde **Public Repository → Dockerfile** uygulaması olarak çalışır.

| Ayar | Değer |
|---|---|
| Repository | `https://github.com/xliry/yapimalzemecim.git` |
| Branch | `main` |
| Build Pack / Build Strategy | `Dockerfile` |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Healthcheck Path | `/api/health` |
| Persistent Storage / Destination Path | `/app/data` |

Public Repository kaynağında URL'yi girip Check Repository seçin. Ardından Dockerfile build pack'i seçin. Host port eşlemesi gerekmez; domain, Coolify proxy üzerinden iç port 3000'e yönlendirilir. Uygulama `0.0.0.0:3000` dinler.

## Ortam değişkenleri

Runtime alanına aşağıdakileri ekleyin. Bunlar build secret olarak gerekmez.

```dotenv
NODE_ENV=production
PORT=3000
DB_PATH=/app/data/quotes.sqlite
TRUST_PROXY=true
SITE_ORIGIN=https://yapimalzemecim.com.tr
FORM_SIGNING_KEY=<en-az-32-karakter-rastgele-deger>
ADMIN_ACCESS_KEY=<farkli-en-az-32-karakter-rastgele-deger>
```

`SITE_ORIGIN` sonuna `/` eklemeyin; yönlendirilecek gerçek HTTPS domainini yazın. Canonical, Open Graph, sitemap, robots ve LLM dosyalarının alan adı runtime'da bu değere uyarlanır. Değeri değiştirmek için görüntüyü yeniden build etmek gerekmez; container yeniden başlatılır. `SITE_ORIGIN` boşsa istek domaini kullanılır.

Anahtarlar kaynak depoya veya Docker imajına gömülmez. Bu çalışma ortamında üretilen kullanıma hazır değerler, Git'e alınmayan `output/coolify-runtime.env` dosyasındadır. Yönetim ekranı `/yonetim/` adresindedir; Coolify sürümünde `ADMIN_ACCESS_KEY` ile giriş yapılır. ChatGPT hesabı gerekmez.

## Kalıcı kayıtlar

Persistent Storage bölümünde bir **Volume** oluşturun; destination path `/app/data` olsun. Talepler SQLite dosyasında ve aynı dizindeki WAL dosyalarında tutulur. Container değişse de bu volume korunur. İlk açılışta migration'lar otomatik uygulanır.

Tek uygulama/replica kullanın. SQLite volume aynı anda birden fazla sunucuya paylaşılmamalıdır. Volume için Coolify'ın yedekleme özelliğini ayrıca etkinleştirebilirsiniz. Bir bind mount kullanılıyorsa dizin uygulamanın `node` kullanıcısı (UID 1000) tarafından yazılabilir olmalıdır.

## Deploy

Domain DNS kaydını Coolify sunucusuna yönlendirin. Bu kurulumda apex A kaydı 161.97.165.194, www CNAME kaydı yapimalzemecim.com.tr olmalıdır. İlk kurulumda ikisi DNS only tutulur; HTTPS doğrulandıktan sonra Cloudflare Full (strict) ile proxy açılabilir. Coolify'da HTTPS domaini ekleyin, runtime değişkenlerini ve volume'u kaydedin, sonra Deploy seçin. Ayrı bir start/build komutu girmeniz gerekmez; Dockerfile bu adımları içerir. Docker healthcheck `/api/health` üzerinden çalışır.

Dağıtım sonrası `/api/health` yanıtı `ok:true` olmalı. Telefon ve WhatsApp bağlantıları **+90 544 330 80 46** numarasını kullanır. Bir deneme talebi oluşturup `/yonetim/` ekranında görünmesini doğrulayın.

## Yerel Node çalıştırma

```sh
npm ci
npm run build:node
node --env-file=.dev.vars generated/node-server.mjs
```

Yerel çalışma için `PORT`, `DB_PATH`, `SITE_ORIGIN` ortam değerleri ayarlanabilir. Dockerfile Node.js 24 kullanır. Sites için mevcut Vinext/D1 build yolu da korunur; Coolify yolu Cloudflare hesabı veya D1 gerektirmez.

Resmi kaynaklar: [Dockerfile kurulumu](https://coolify.io/docs/applications/builds/dockerfile), [Kalıcı depolama](https://coolify.io/docs/applications/configuration/persistent-storage).
