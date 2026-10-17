import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { products } from '../src/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.QA_ORIGIN || 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH || process.env.QA_CHROME || 'C:/Users/mdmel/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const reportPath = path.join(root, 'output', 'functional-qa.json');
const tests = [];
const pageAudits = [];
const runtime = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], httpErrors: [], requests: [] };
const internalLinks = new Set();
const hostedAuthLinks = new Set();
const quoteFixture = { ok: true, reference: 'YM-TEST2345', id: '42f62ee6-c81e-43d8-b43e-9a1385c52b5d' };
const viewports = [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }];
let browser;

function requireThat(condition, message) { if (!condition) throw new Error(message); }
async function stubQuoteApi(context) {
  const submissions = [];
  await context.route('**/api/quote-token', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'qa-ui-token' }) }));
  await context.route('**/api/quotes', route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(quoteFixture) });
  });
  return { submissions };
}
async function test(name, viewport, action) {
  const started = Date.now();
  try {
    const detail = await action();
    tests.push({ name, viewport, status: 'passed', durationMs: Date.now() - started, ...(detail ? { detail } : {}) });
  } catch (error) {
    tests.push({ name, viewport, status: 'failed', durationMs: Date.now() - started, error: error.message });
  }
}
async function htmlRoutes(directory, prefix = '') {
  const routes = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) routes.push(...await htmlRoutes(path.join(directory, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith('.html')) routes.push(rel === 'index.html' ? '/' : `/${rel.replace(/\/index\.html$/, '/')}`);
  }
  return routes.sort();
}
function attachMonitoring(page, viewport) {
  page.on('console', message => {
    const location = message.location().url || page.url();
    if (/^Failed to load resource: the server responded with a status of 404/.test(message.text()) && new URL(location).pathname === '/404.html') return;
    const item = { viewport, page: page.url(), text: message.text() };
    if (message.type() === 'error') runtime.consoleErrors.push(item);
    if (message.type() === 'warning') runtime.consoleWarnings.push(item);
  });
  page.on('pageerror', error => runtime.pageErrors.push({ viewport, page: page.url(), message: error.message }));
  page.on('request', request => runtime.requests.push({ viewport, method: request.method(), url: request.url(), resourceType: request.resourceType() }));
  page.on('requestfailed', request => {
    // Client-side page navigation can cancel an in-flight image request normally.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    runtime.failedRequests.push({ viewport, page: page.url(), url: request.url(), error: request.failure()?.errorText });
  });
  page.on('response', response => {
    if (response.status() === 404 && response.request().isNavigationRequest() && new URL(response.url()).pathname === '/404.html') return;
    if (response.status() >= 400) runtime.httpErrors.push({ viewport, page: page.url(), url: response.url(), status: response.status() });
  });
}
async function go(page, pathname) {
  const response = await page.goto(new URL(pathname, base).href, { waitUntil: 'networkidle', timeout: 25000 });
  const expectedStatus = pathname === '/404.html' ? 404 : 200;
  requireThat(response?.status() === expectedStatus, `${pathname}: HTTP ${response?.status()} (beklenen ${expectedStatus})`);
  await page.evaluate(() => document.fonts.ready);
}
async function overflow(page) {
  return page.evaluate(() => {
    const width = innerWidth;
    const actual = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const offenders = actual > width + 1 ? [...document.querySelectorAll('body *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return getComputedStyle(element).display !== 'none' && rect.width > 0 && (rect.right > width + 2 || rect.left < -2);
    }).slice(0, 8).map(element => ({ element: element.tagName.toLowerCase(), className: String(element.className).slice(0, 120), right: Math.round(element.getBoundingClientRect().right) })) : [];
    return { width, scrollWidth: actual, overflow: Math.max(0, actual - width), offenders };
  });
}
async function auditPage(page, pathname, viewport) {
  const record = { viewport, path: pathname, status: 'passed', overflow: [], brokenImages: [], emptyLinks: [] };
  const started = Date.now();
  try {
    await go(page, pathname);
    const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
    // Pass through the document so lazy images and scroll-triggered sections run.
    const step = Math.max(500, Math.round(page.viewportSize().height * 0.85));
    for (let top = 0; top <= max + step; top += step) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.min(top, max));
      await page.waitForTimeout(55);
    }
    await page.waitForTimeout(120);
    for (const position of [0, max / 2, max]) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), position);
      await page.waitForTimeout(70);
      const result = await overflow(page);
      if (result.overflow > 1) record.overflow.push({ position: Math.round(position), ...result });
    }
    // Hidden gallery frames may deliberately defer their image request until selected.
    record.brokenImages = await page.locator('img').evaluateAll(images => images.filter(image => image.getClientRects().length > 0 && (!image.complete || image.naturalWidth === 0)).map(image => ({ src: image.currentSrc || image.src, complete: image.complete })));
    record.emptyLinks = await page.locator('a').evaluateAll(links => links.filter(link => link.hasAttribute('href') && !link.getAttribute('href').trim()).map(link => link.textContent.trim()));
    // A fragment-only skip link on the intentional 404 page is not a broken route link.
    const links = await page.locator('a[href]').evaluateAll(anchors => anchors.filter(anchor => !anchor.getAttribute('href').startsWith('#')).map(anchor => anchor.href));
    for (const href of links) {
      const url = new URL(href);
      if (url.origin === new URL(base).origin && /^https?:$/.test(url.protocol)) {
        // These endpoints belong to the hosting provider, not the local Vinext app.
        if (['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].includes(url.pathname)) { hostedAuthLinks.add(url.href); continue; }
        url.hash = ''; url.search = '';
        internalLinks.add(url.href);
      }
    }
    record.title = await page.title();
    record.h1Count = await page.locator('h1').count();
    requireThat(record.h1Count === 1, `h1 sayısı: ${record.h1Count}`);
    requireThat(record.overflow.length === 0, `Yatay taşma: ${JSON.stringify(record.overflow)}`);
    requireThat(record.brokenImages.length === 0, `Yüklenmeyen görsel: ${JSON.stringify(record.brokenImages)}`);
    requireThat(record.emptyLinks.length === 0, 'Boş href bulundu');
  } catch (error) { record.status = 'failed'; record.error = error.message; }
  record.durationMs = Date.now() - started;
  pageAudits.push(record);
}
async function interactions(context, viewport, quoteApi) {
  const page = await context.newPage();
  attachMonitoring(page, `${viewport}-interactive`);
  await go(page, '/');
  if (viewport === 'mobile') {
    await test('mobile-menu-open-escape', viewport, async () => {
      const toggle = page.locator('.menu-toggle');
      requireThat(await toggle.isVisible(), 'Mobil menü düğmesi görünmüyor');
      await toggle.click();
      requireThat(await toggle.getAttribute('aria-expanded') === 'true', 'Menü açılmadı');
      requireThat(await page.locator('.main-nav').isVisible(), 'Gezinme alanı görünmüyor');
      requireThat(await page.locator('body').evaluate(body => body.classList.contains('menu-open')), 'Gövde kaydırma kilidi yok');
      await page.keyboard.press('Escape');
      requireThat(await toggle.getAttribute('aria-expanded') === 'false', 'Escape menüyü kapatmadı');
      requireThat(!await page.locator('.main-nav').isVisible(), 'Kapalı menü görünmeye devam ediyor');
      requireThat(!await page.locator('body').evaluate(body => body.classList.contains('menu-open')), 'Gövde kaydırma kilidi kaldırılmadı');
    });
    await test('mobile-menu-accessible-label-after-escape', viewport, async () => {
      requireThat(await page.locator('.menu-toggle').getAttribute('aria-label') === 'Menüyü aç', 'Escape sonrası aria-label “Menüyü aç” olmalı');
    });
    await test('mobile-menu-navigation', viewport, async () => {
      await page.locator('.menu-toggle').click();
      await Promise.all([page.waitForURL('**/urunler/'), page.locator('.main-nav a[href="/urunler/"]').click()]);
      requireThat(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false', 'Yeni sayfada menü açık kaldı');
      requireThat(!await page.locator('.main-nav').isVisible(), 'Yeni sayfada gezinme alanı açık');
    });
  }
  await test('product-filters', viewport, async () => {
    await go(page, '/urunler/');
    const result = {};
    requireThat(await page.locator('.product-card').count() === products.length, 'Ürün kartları ürün kataloğuyla aynı sayıda değil');
    const filters = [...new Set(products.map(product => product.group)), 'all'];
    for (const filter of filters) {
      const expected = filter === 'all' ? products.length : products.filter(product => product.group === filter).length;
      const button = page.locator(`[data-filter="${filter}"]`);
      await button.click();
      const count = await page.locator('.product-card:visible').count();
      requireThat(count === expected, `${filter}: ${expected} yerine ${count} kart görünüyor`);
      requireThat(await button.getAttribute('aria-pressed') === 'true', `${filter}: aktiflik erişilebilir duruma yansımadı`);
      requireThat(await page.locator('[data-filter][aria-pressed="true"]').count() === 1, 'Birden fazla aktif filtre var');
      result[filter] = count;
    }
    return result;
  });
  await go(page, '/');
  await test('calculator-100m2-10percent-36sheets', viewport, async () => {
    await page.locator('#calculator [name="area"]').fill('100');
    await page.locator('#calculator [name="size"]').selectOption('3.125');
    await page.locator('#calculator [name="waste"]').selectOption('10');
    requireThat(await page.locator('#calc-output strong').textContent() === '36', '100 m² ve %10 için 36 levha bulunmalı');
    requireThat((await page.locator('#calc-area').textContent()).includes('112,50'), 'Toplam levha alanı 112,50 m² olmalı');
    const href = await page.locator('#calc-quote').getAttribute('href');
    const params = new URL(href, base).searchParams;
    requireThat(params.get('miktar') === '36' && params.get('birim') === 'adet' && params.get('ebat') === '1250x2500', 'Hesap sonucu teklif parametrelerine aktarılmadı');
    return { sheets: 36, totalArea: '112,50', quoteHref: href };
  });
  await test('calculator-alternative-size-and-invalid-input', viewport, async () => {
    await page.locator('#calculator [name="size"]').selectOption('2.9768');
    requireThat(await page.locator('#calc-output strong').textContent() === '37', '1220 × 2440 mm için 37 levha bulunmalı');
    await page.locator('#calculator [name="area"]').fill('0');
    requireThat(await page.locator('#calc-quote').getAttribute('aria-disabled') === 'true', 'Geçersiz alanda teklif bağlantısı devre dışı kalmadı');
    requireThat(await page.locator('#calc-quote').getAttribute('href') === null, 'Geçersiz alanda eski teklif adresi kaldı');
    await page.locator('#calculator [name="area"]').fill('100');
    await page.locator('#calculator [name="size"]').selectOption('3.125');
  });
  await test('material-layer-and-surface-control', viewport, async () => {
    const captions = {};
    for (const view of ['yuzey', 'katman']) {
      const other = view === 'yuzey' ? 'katman' : 'yuzey';
      const button = page.locator(`[data-material-select="${view}"]`);
      await button.click();
      requireThat(await button.getAttribute('aria-pressed') === 'true', `${view}: seçili düğmenin aria-pressed durumu güncellenmedi`);
      requireThat(await page.locator(`[data-material-select="${other}"]`).getAttribute('aria-pressed') === 'false', `${view}: önceki seçim temizlenmedi`);
      const frame = page.locator(`[data-material-frame="${view}"]`);
      requireThat(await frame.isVisible(), `${view}: seçilen fotoğraf görünmüyor`);
      requireThat(!await page.locator(`[data-material-frame="${other}"]`).isVisible(), `${view}: diğer fotoğraf gizlenmedi`);
      await page.waitForFunction(selected => {
        const image = document.querySelector(`[data-material-frame="${selected}"] img`);
        return image?.complete && image.naturalWidth > 0;
      }, view);
      captions[view] = (await page.locator('[data-material-caption]').textContent()).trim();
      requireThat(captions[view].length > 0, `${view}: fotoğraf açıklaması boş`);
    }
    requireThat(captions.yuzey !== captions.katman, 'Katman ve yüzey açıklamaları değişmiyor');
    const tracked = await page.evaluate(() => window.dataLayer?.some(item => item.event === 'material_explore'));
    requireThat(tracked, 'Malzeme etkileşimi dataLayer olayına yansımadı');
    return { captions };
  });
  await test('quote-url-parameters', viewport, async () => {
    await go(page, '/teklif/?urun=plywood&miktar=36&birim=adet&ebat=1250x2500');
    requireThat(await page.locator('#quote-form [name="product"]').inputValue() === 'plywood', 'Ürün parametresi dolmadı');
    requireThat(await page.locator('#quote-form [name="quantity"]').inputValue() === '36', 'Miktar parametresi dolmadı');
    requireThat(await page.locator('#quote-form [name="unit"]').inputValue() === 'adet', 'Birim parametresi dolmadı');
    requireThat((await page.locator('#quote-form [name="details"]').inputValue()).includes('1250x2500'), 'Ebat parametresi detaylara aktarılmadı');
  });
  await test('quote-required-validation', viewport, async () => {
    await page.locator('#quote-form button[type="submit"]').click();
    requireThat(!await page.locator('#quote-result').isVisible(), 'Eksik form talep özeti oluşturdu');
    requireThat(await page.locator('#quote-form :invalid').count() > 0, 'Gerekli alan doğrulaması bulunamadı');
  });
  await test('quote-phone-validation', viewport, async () => {
    const phone = page.locator('#quote-form [name="phone"]');
    await phone.fill('abcdefghijk');
    requireThat(!await phone.evaluate(input => input.checkValidity()), 'Telefon alanı harflerden oluşan geçersiz değeri reddetmiyor');
    for (const value of ['05550000000', '+90 (555) 000-00-00']) {
      await phone.fill(value);
      requireThat(await phone.evaluate(input => input.checkValidity()), `Geçerli telefon biçimi reddedildi: ${value}`);
    }
  });
  let preview = '';
  await test('quote-fill-submit-api-confirmation', viewport, async () => {
    await page.locator('#quote-form [name="name"]').fill('QA Test Kullanıcısı');
    await page.locator('#quote-form [name="company"]').fill('Yerel İşlev Testi');
    await page.locator('#quote-form [name="phone"]').fill('05550000000');
    await page.locator('#quote-form [name="email"]').fill('qa@example.invalid');
    await page.locator('#quote-form [name="thickness"]').fill('21 mm');
    await page.locator('#quote-form [name="city"]').fill('İstanbul');
    await page.locator('#quote-form [name="consent"]').check();
    const requestStart = runtime.requests.length;
    const submissionStart = quoteApi.submissions.length;
    await page.locator('#quote-form button[type="submit"]').click();
    await page.locator('#quote-result').waitFor({ state: 'visible' });
    preview = await page.locator('#quote-preview').textContent();
    for (const value of ['QA Test Kullanıcısı', '21 mm', '36 adet', 'İstanbul', '1250x2500']) requireThat(preview.includes(value), `Özet alanı eksik: ${value}`);
    requireThat(await page.locator('#quote-result h3').textContent() === 'Talebiniz alındı.', 'Sunucu onayı başarı mesajına yansımadı');
    requireThat(preview.includes(quoteFixture.reference), 'Sunucunun talep numarası özete aktarılmadı');
    requireThat((await page.locator('#quote-result-status').textContent()).includes(quoteFixture.reference), 'Talep numarası durum mesajında yok');
    const posts = runtime.requests.slice(requestStart).filter(request => request.method === 'POST');
    requireThat(posts.length === 1 && new URL(posts[0].url).pathname === '/api/quotes', 'Talep yalnızca teklif API uç noktasına bir kez gönderilmeli');
    requireThat(quoteApi.submissions.length === submissionStart + 1, 'Stub teklif API çağrısı kaydedilmedi');
    const payload = quoteApi.submissions.at(-1);
    requireThat(payload.name === 'QA Test Kullanıcısı' && payload.product === 'plywood' && payload.quantity === 36 && payload.unit === 'adet' && payload.consent === true, 'Form verileri API isteğine doğru aktarılmadı');
    requireThat(payload.token === 'qa-ui-token' && /^[0-9a-f-]{36}$/i.test(payload.requestId), 'İstek belirteci veya kimliği gönderilmedi');
    requireThat(await page.evaluate(() => window.dataLayer?.some(item => item.event === 'quote_prepared' && item.product === 'plywood')), 'Teklif hazırlama olayı bulunamadı');
    requireThat(await page.evaluate(() => window.dataLayer?.some(item => item.event === 'quote_submitted' && item.product === 'plywood')), 'Başarılı gönderim olayı bulunamadı');
    return { mockedApi: true, reference: quoteFixture.reference };
  });
  await test('quote-success-resubmit-does-not-duplicate', viewport, async () => {
    const submissionStart = quoteApi.submissions.length;
    await page.locator('#quote-form button[type="submit"]').click();
    await page.waitForTimeout(120);
    requireThat(quoteApi.submissions.length === submissionStart, 'Değiştirilmemiş başarılı talep ikinci kez gönderildi');
    requireThat(await page.locator('#quote-result h3').textContent() === 'Talebiniz alındı.', 'Mevcut talep onayı korunmadı');
  });
  await test('quote-download-content', viewport, async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-quote').click()]);
    requireThat(download.suggestedFilename() === 'yapi-malzemecim-teklif-talebi.txt', 'İndirme dosya adı farklı');
    const contents = await fs.readFile(await download.path(), 'utf8');
    requireThat(contents.replace(/^\uFEFF/, '') === preview, 'İndirilen dosya talep özetiyle aynı değil');
    return { filename: download.suggestedFilename(), characters: contents.length };
  });
  await test('quote-copy-clipboard-content', viewport, async () => {
    await page.locator('#copy-quote').click();
    await page.waitForTimeout(120);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The Windows system clipboard normalizes line endings to CRLF.
    requireThat(copied.replace(/\r\n/g, '\n') === preview.replace(/\r\n/g, '\n'), 'Panoya kopyalanan metin talep özetiyle aynı değil');
  });
  await test('quote-copy-success-feedback', viewport, async () => {
    requireThat((await page.locator('#copy-quote').textContent()).includes('Özet kopyalandı'), 'Kopyalama başarılı olsa da düğmede başarı bildirimi yok');
    requireThat(!(await page.locator('#quote-result-status').textContent()).includes('Otomatik kopyalama kullanılamıyor'), 'Başarılı kopyalamada hata bildirimi gösteriliyor');
  });
  await test('quote-copy-denied-fallback', viewport, async () => {
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new DOMException('QA simulated clipboard denial', 'NotAllowedError'); }; });
    await page.locator('#copy-quote').click();
    await page.waitForTimeout(80);
    requireThat((await page.locator('#quote-result-status').textContent()).includes('Otomatik kopyalama kullanılamıyor'), 'Kopyalama reddinde manuel kopyalama/indirme yönlendirmesi yok');
    requireThat(await page.locator('#download-quote').isVisible(), 'Kopyalama reddinde dosya indirme alternatifi görünmüyor');
  });
  await test('consent-settings-denied-persistence', viewport, async () => {
    await page.locator('[data-consent-settings]').click();
    requireThat(await page.locator('#consent').isVisible(), 'Çerez tercihleri açılmadı');
    await page.locator('[data-consent="denied"]').click();
    requireThat(!await page.locator('#consent').isVisible(), 'Reddetme sonrası panel kapanmadı');
    requireThat(await page.evaluate(() => localStorage.getItem('ym-consent')) === 'denied', 'Ret tercihi saklanmadı');
    await page.reload({ waitUntil: 'networkidle' });
    requireThat(!await page.locator('#consent').isVisible(), 'Ret tercihi yenilemede korunmadı');
    requireThat(await page.evaluate(() => localStorage.getItem('ym-consent')) === 'denied', 'Yenilemede ret tercihi kayboldu');
    requireThat(await page.locator('script[src*="googletagmanager"],script[src*="connect.facebook.net"]').count() === 0, 'Ret durumunda reklam/analiz betiği yüklendi');
    await page.locator('[data-consent-settings]').click();
    requireThat(await page.locator('#consent').isVisible(), 'Tercihler tekrar açılamadı');
    await page.locator('[data-consent="denied"]').click();
  });
  await page.close();
}

try {
  const routes = await htmlRoutes(path.join(root, 'generated', 'ssg'));
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, isMobile: viewport.name === 'mobile', hasTouch: viewport.name === 'mobile', acceptDownloads: true });
    const quoteApi = await stubQuoteApi(context);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const page = await context.newPage();
    attachMonitoring(page, viewport.name);
    for (const route of routes) await auditPage(page, route, viewport.name);
    console.log(`${viewport.name}: ${routes.length} sayfa taraması tamamlandı.`);
    await page.close();
    await interactions(context, viewport.name, quoteApi);
    console.log(`${viewport.name}: etkileşim testleri tamamlandı.`);
    await context.close();
  }
  await test('internal-link-http-targets', 'all', async () => {
    const context = await browser.newContext();
    const broken = [];
    for (const href of [...internalLinks].sort()) {
      const response = await context.request.get(href);
      if (response.status() >= 400) broken.push({ href, status: response.status() });
    }
    await context.close();
    requireThat(broken.length === 0, JSON.stringify(broken));
    return { checked: internalLinks.size };
  });
  await test('reduced-motion-functional-and-stable', 'mobile-reduced', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await stubQuoteApi(context);
    const page = await context.newPage();
    attachMonitoring(page, 'mobile-reduced');
    try {
      await go(page, '/');
      requireThat(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'Azaltılmış hareket tercihi aktif değil');
      const before = await page.locator('.hero-photo,.hero-aura,.hero h1>span').evaluateAll(elements => elements.map(element => getComputedStyle(element).transform));
      await page.waitForTimeout(500);
      const after = await page.locator('.hero-photo,.hero-aura,.hero h1>span').evaluateAll(elements => elements.map(element => getComputedStyle(element).transform));
      requireThat(before.every(value => value === 'none') && after.every(value => value === 'none'), 'Azaltılmış harekette hero hareketi var');
      await page.locator('[data-material-select="yuzey"]').click();
      requireThat(await page.locator('[data-material-frame="yuzey"]').isVisible(), 'Azaltılmış harekette yüzey fotoğrafı seçilemiyor');
      requireThat(await page.locator('[data-material-select="yuzey"]').getAttribute('aria-pressed') === 'true', 'Azaltılmış harekette yüzey kontrolü seçili değil');
      requireThat((await page.locator('[data-material-caption]').textContent()).trim().length > 0, 'Azaltılmış harekette fotoğraf açıklaması boş');
      requireThat(await page.locator('[data-material-frame="yuzey"] img').evaluate(image => getComputedStyle(image).transform) === 'none', 'Azaltılmış harekette numune görseli animasyonu çalışıyor');
      requireThat(await page.locator('#calc-output strong').textContent() === '36', 'Azaltılmış harekette hesaplayıcı çalışmıyor');
      requireThat((await overflow(page)).overflow <= 1, 'Azaltılmış harekette yatay taşma var');
      return { preference: 'reduce', heroTransforms: after };
    } finally { await context.close(); }
  });
} catch (error) {
  tests.push({ name: 'qa-runner', viewport: 'all', status: 'failed', error: error.stack ?? error.message });
} finally {
  await browser?.close();
}

const failedTests = tests.filter(test => test.status === 'failed').length;
const failedPages = pageAudits.filter(page => page.status === 'failed').length;
const runtimeFailures = runtime.consoleErrors.length + runtime.pageErrors.length + runtime.failedRequests.length + runtime.httpErrors.length;
const report = {
  generatedAt: new Date().toISOString(), base, executablePath,
  scope: { uiQuoteApi: 'Playwright route ile deterministik başarılı yanıt; gerçek API ve kalıcı kayıt scripts/test-api.mjs kapsamındadır.', hostedAuthLinksNotRequested: [...hostedAuthLinks] },
  status: failedTests || failedPages || runtimeFailures ? 'failed' : 'passed',
  summary: { pageViewportChecks: pageAudits.length, failedPages, interactionTests: tests.length, failedTests, consoleErrors: runtime.consoleErrors.length, consoleWarnings: runtime.consoleWarnings.length, pageErrors: runtime.pageErrors.length, failedRequests: runtime.failedRequests.length, httpErrors: runtime.httpErrors.length },
  pageAudits, tests, runtime,
};
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
for (const item of [...pageAudits, ...tests].filter(item => item.status === 'failed')) console.error(`${item.viewport} | ${item.name ?? item.path}: ${item.error}`);
console.log(`Report: output/functional-qa.json (${report.status})`);
process.exitCode = report.status === 'passed' ? 0 : 1;
