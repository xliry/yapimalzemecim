import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:4176';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Users/mdmel/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const results = [], errors = [];
async function run(name, action) {
  await action(); results.push({ name, passed: true }); console.log(`PASS: ${name}`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  const imageRequests = [];
  page.on('request', request => { if (/hero-(truck|dispatch|warehouse|forklift|load)-\d+\.(avif|webp)/.test(request.url())) imageRequests.push(request.url()); });
  await page.goto(origin, { waitUntil: 'networkidle' });
  const current = () => page.locator('[data-hero-slide].is-active').getAttribute('data-caption');
  await run('Only the first photograph downloads on initial load', async () => {
    assert.equal(imageRequests.length, 1);
    assert.match(imageRequests[0], /hero-truck-/);
    assert.equal(await page.locator('[data-hero-slide] img').count(), 1);
  });
  await run('Automatic rotation continues while the pointer rests over the hero', async () => {
    await page.mouse.move(900, 400);
    const before = await current();
    await page.waitForFunction(title => document.querySelector('[data-hero-slide].is-active').dataset.caption !== title, before, { timeout: 8000 });
  });
  await run('Pointer selection continues rotating without removing button focus', async () => {
    await page.locator('[data-gallery-select]').nth(2).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-gallery-select]')[2].getAttribute('aria-pressed') === 'true');
    assert(await page.locator('[data-gallery-select]').nth(2).evaluate(button => button === document.activeElement));
    const before = await current();
    await page.waitForFunction(title => document.querySelector('[data-hero-slide].is-active').dataset.caption !== title, before, { timeout: 8000 });
  });
  await run('All five photographs load and manual selection updates the accessible state', async () => {
    for (let index = 1; index < 5; index++) {
      await page.locator('[data-gallery-select]').nth(index).click();
      await page.waitForFunction(i => document.querySelectorAll('[data-hero-slide]')[i].classList.contains('is-active'), index);
      assert.equal(await page.locator('[data-gallery-select][aria-pressed=true]').count(), 1);
      assert.equal(await page.locator('[data-hero-slide][aria-hidden=false]').count(), 1);
      assert(await page.locator('[data-hero-slide].is-active img').evaluate(img => img.complete && img.naturalWidth > 0));
    }
  });
  await run('Keyboard arrows, Home and End select the appropriate photograph', async () => {
    await page.locator('[data-gallery-select]').nth(4).press('Home');
    await page.waitForFunction(() => document.querySelector('[data-gallery-select]').getAttribute('aria-pressed') === 'true');
    await page.locator('[data-gallery-select]').nth(0).press('ArrowLeft');
    await page.waitForFunction(() => document.querySelectorAll('[data-gallery-select]')[4].getAttribute('aria-pressed') === 'true');
    await page.locator('[data-gallery-select]').nth(4).press('End');
    assert.equal(await current(), 'Detaylarıyla planlı');
  });
  await run('Keyboard navigation pauses rotation and Play resumes while its button stays focused', async () => {
    assert.equal(await page.locator('[data-gallery-pause]').getAttribute('data-paused'), 'true');
    const before = await current();
    await page.waitForTimeout(5600);
    assert.equal(await current(), before);
    await page.locator('[data-gallery-pause]').click();
    assert(await page.locator('[data-gallery-pause]').evaluate(button => button === document.activeElement));
    await page.waitForFunction(title => document.querySelector('[data-hero-slide].is-active').dataset.caption !== title, before, { timeout: 8000 });
    await page.locator('[data-gallery-pause]').click();
    const paused = await current();
    await page.waitForTimeout(5600);
    assert.equal(await current(), paused);
    await page.locator('[data-gallery-pause]').click();
  });
  await run('Reduced motion starts paused and allows explicit Play without animated transitions', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-gallery-pause]').dataset.paused === 'true');
    assert.equal(await page.locator('[data-gallery-pause]').isVisible(), true);
    const before = await current();
    await page.waitForTimeout(5600);
    assert.equal(await current(), before);
    await page.locator('[data-gallery-select]').nth(2).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-gallery-select]')[2].getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('.hero-slide').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    const selected = await current();
    await page.locator('[data-gallery-pause]').click();
    await page.waitForFunction(title => document.querySelector('[data-hero-slide].is-active').dataset.caption !== title, selected, { timeout: 8000 });
    await page.locator('[data-gallery-pause]').click();
  });
  await run('Mobile photographs have no overflow and every gallery control has a 44 px target', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (let index = 0; index < 5; index++) {
      await page.locator('[data-gallery-select]').nth(index).click();
      await page.waitForFunction(i => document.querySelectorAll('[data-gallery-select]')[i].getAttribute('aria-pressed') === 'true', index);
      assert(await page.locator('[data-hero-slide].is-active img').evaluate(img => img.naturalWidth > 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (index === 0 || index === 4) await page.screenshot({ path: `output/hero-mobile-${index + 1}.png` });
    }
    for (const button of await page.locator('[data-gallery-select]').all()) {
      const box = await button.boundingBox(); assert(box.width >= 44 && box.height >= 44);
    }
  });
  await page.close();
  await run('Automatic rotation skips an unavailable photograph', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    await context.route('**/assets/hero-dispatch-*', route => route.abort());
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.mouse.move(900, 400);
    await page.waitForFunction(() => document.querySelectorAll('[data-hero-slide]')[2].classList.contains('is-active'), null, { timeout: 8000 });
    assert(await page.locator('.hero-slide.is-active img').evaluate(img => img.naturalWidth > 0));
    await context.close();
  });
  await run('The main photograph and headline remain visible without JavaScript', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').count(), 1);
    assert(await page.locator('.hero-slide.is-active img').evaluate(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('[data-gallery-controls]').isVisible(), false);
    await context.close();
  });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await fs.mkdir('output', { recursive: true });
  await fs.writeFile('output/hero-gallery-qa.json', JSON.stringify({ results, errors }, null, 2));
}
