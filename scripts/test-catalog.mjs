import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { products } from '../src/content.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'ym-catalog-'));
const adminKey = randomBytes(32).toString('hex');
const child = spawn(process.execPath, ['generated/node-server.mjs'], { env: { ...process.env, PORT: '0', DB_PATH: path.join(directory, 'test.sqlite'), SITE_ORIGIN: '', TRUST_PROXY: 'false', ADMIN_ACCESS_KEY: adminKey, FORM_SIGNING_KEY: randomBytes(32).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'] });
const results = [], errors = [];
let browser, origin, reference;
const record = (name, detail) => { results.push({ name, passed: true, ...detail }); console.log(`PASS: ${name}`); };
try {
  origin = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Isolated test server did not start')), 10000);
    child.stdout.on('data', chunk => { output += chunk; const match = /listening on port (\d+)/.exec(output); if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); } });
    child.once('error', reject);
  });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Users/mdmel/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
  for (const [viewport, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'networkidle' });
    for (const [group, count] of ['all', ...new Set(products.map(p=>p.group))].map(group=>[group,group==='all'?products.length:products.filter(p=>p.group===group).length])) {
      await page.locator(`[data-filter="${group}"]`).click();
      assert.equal(await page.locator('.product-card:visible').count(), count);
    }
    await page.locator('[data-material-select="yuzey"]').click();
    assert(await page.locator('[data-material-frame="yuzey"]').isVisible());
    await page.locator('[data-material-select="katman"]').click();
    assert(await page.locator('[data-material-frame="katman"]').isVisible());
    record(`${viewport}: filters and material views`);
    for (const product of products) {
      await page.goto(origin + `/urunler/${product.slug}/`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('[data-product-select]').count(), product.gallery.length);
      for (let index = 0; index < product.gallery.length; index++) {
        await page.locator(`[data-product-select="${index}"]`).click();
        await page.waitForFunction(i => { const img = document.querySelector(`[data-product-frame="${i}"] img`); return img?.complete && img.naturalWidth > 0; }, index);
        assert.equal(await page.locator('[data-product-select][aria-pressed=true]').count(), 1);
        assert.equal(await page.locator('[data-product-frame]:visible').count(), 1);
      }
      await page.locator('[data-product-zoom]').click();
      assert(await page.locator('[data-product-dialog]').evaluate(dialog => dialog.open));
      await page.waitForFunction(() => { const image = document.querySelector('[data-product-full]'); return image.complete && image.naturalWidth > 0; });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-product-dialog]').evaluate(dialog => dialog.open), false);
      assert(await page.locator('[data-product-zoom]').evaluate(el => el === document.activeElement));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      record(`${viewport}: ${product.slug} gallery and zoom`);
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(origin + '/urunler/bims-blok-25/', { waitUntil: 'networkidle' });
  await page.locator('.detail-copy a.button').click();
  assert.equal(await page.locator('[name=product]').inputValue(), 'bims-blok-25');
  for (const [field, value] of Object.entries({ name: 'Katalog Akış Testi', company: 'TEST', phone: '05000000000', thickness: '25’lik — 9 BB 25', quantity: '20', city: 'Test', details: 'Otomatik yerel test; ticari talep değildir.' })) await page.locator(`#quote-form [name="${field}"]`).fill(value);
  await page.locator('[name=consent]').check();
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#quote-result h3')?.textContent === 'Talebiniz alındı.');
  const summary = await page.locator('#quote-preview').innerText();
  assert(summary.includes('25’lik Bims Blok'));
  reference = summary.match(/YM-[A-Z0-9]+/)?.[0]; assert(reference);
  const whatsapp = new URL(await page.locator('#send-whatsapp').getAttribute('href'));
  assert(whatsapp.searchParams.get('text').includes('25’lik Bims Blok'));
  const auth = { Authorization: `Bearer ${adminKey}` };
  const saved = (await (await fetch(origin + '/api/admin/quotes', { headers: auth })).json()).quotes.find(q => q.reference === reference);
  assert.equal(saved.product, 'bims-blok-25'); assert.equal(saved.quantity, 20);
  await page.goto(origin + '/yonetim/', { waitUntil: 'networkidle' });
  await page.locator('#admin-key').fill(adminKey);
  await page.locator('#admin-login button').click();
  const row = page.locator('.admin-lead').filter({ hasText: reference });
  await row.waitFor(); assert((await row.innerText()).includes('25’lik Bims Blok'));
  await row.locator('select').selectOption('contacted');
  await page.waitForFunction(ref => document.querySelector('#admin-status').textContent.includes(ref + ' durumu güncellendi.'), reference);
  const updated = (await (await fetch(origin + '/api/admin/quotes', { headers: auth })).json()).quotes.find(q => q.reference === reference);
  assert.equal(updated.status, 'contacted');
  record('Bims product → prefilled quote → real SQLite record → WhatsApp summary → admin label and status');
  for(const slug of ['bims-blok-20','bims-blok-24','delikli-tugla','kiremit-cati-aksesuarlari']){
    const product=products.find(p=>p.slug===slug);
    await page.goto(origin+'/urunler/'+slug+'/',{waitUntil:'networkidle'});
    if(product.options){
      for(const option of product.options){
        const link=page.locator('.product-choices a').filter({hasText:option});
        const href=await link.getAttribute('href');
        await page.goto(origin+href,{waitUntil:'networkidle'});
        assert((await page.locator('[name=details]').inputValue()).includes(option));
        await page.goBack({waitUntil:'networkidle'});
      }
      await page.locator('.product-choices a').filter({hasText:'Metal kiremit'}).click();
    }else await page.locator('.detail-copy a.button').click();
    assert.equal(await page.locator('[name=product]').inputValue(),slug);
    for(const [field,value]of Object.entries({name:'Yeni Ürün Testi',phone:'05000000000',quantity:'20',city:'Test'}))await page.locator('#quote-form [name="'+field+'"]').fill(value);
    await page.locator('[name=consent]').check();await page.locator('#quote-form button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#quote-result h3')?.textContent==='Talebiniz alındı.');
    const text=await page.locator('#quote-preview').innerText();assert(text.includes(product.title));
    if(product.options)assert(text.includes('Metal kiremit'));
    const data=await(await fetch(origin+'/api/admin/quotes',{headers:auth})).json();
    const entry=data.quotes.find(q=>q.product===slug);assert(entry);
    if(product.options)assert(entry.details.includes('Metal kiremit'));
    await page.goto(origin+'/yonetim/',{waitUntil:'networkidle'});await page.locator('#admin-key').fill(adminKey);await page.locator('#admin-login button').click();
    const row=page.locator('.admin-lead').filter({hasText:entry.reference});await row.waitFor();assert((await row.innerText()).includes(product.title));
    record(slug+': product selection, real record and admin label');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
  const absolute = path.resolve(directory);
  if (absolute.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(absolute).startsWith('ym-catalog-')) await rm(absolute, { recursive: true, force: true });
  await mkdir('output', { recursive: true });
  await writeFile('output/catalog-qa.json', JSON.stringify({ results, errors }, null, 2));
}
