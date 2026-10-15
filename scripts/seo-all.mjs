import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'dist', 'site-manifest.json');
const outputDir = path.join(root, 'output', 'lighthouse-seo');
const base = process.env.SEO_ORIGIN || 'http://127.0.0.1:4173';
const port = Number(process.env.SEO_DEBUG_PORT || 9230);
const executablePath = process.env.CHROME_PATH || process.env.QA_CHROME || 'C:/Users/mdmel/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const results = [];
const runErrors = [];
const startedAt = new Date().toISOString();
let browser;
let targets = [];

try {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 9229) throw new Error('SEO_DEBUG_PORT 1024–65535 arasında ve root denetiminin 9229 portundan farklı olmalı.');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) throw new Error('site-manifest.json içinde pages dizisi bulunamadı veya boş.');
  const seen = new Set();
  for (const page of manifest.pages) {
    if (page.noindex || page.indexable === false || /(?:^|\/)404(?:\.html|\/)?$/.test(page.path ?? '')) continue;
    if (typeof page.path !== 'string' || !page.path.startsWith('/') || page.path.startsWith('//') || /[?#]/.test(page.path)) throw new Error(`Manifestte geçersiz sayfa yolu: ${JSON.stringify(page.path)}`);
    if (seen.has(page.path)) throw new Error(`Manifestte tekrarlanan sayfa: ${page.path}`);
    seen.add(page.path);
    targets.push({ path: page.path, title: page.title });
  }
  if (!targets.length) throw new Error('Manifestte indexlenebilir sayfa bulunamadı.');
  await fs.mkdir(outputDir, { recursive: true });
  // This script owns this browser only; it never attaches to or closes port 9229.
  browser = await chromium.launch({ executablePath, headless: true, args: [`--remote-debugging-port=${port}`] });
  for (const target of targets) {
    const started = Date.now();
    const name = target.path === '/' ? 'home' : target.path.split('/').filter(Boolean).join('-').replace(/[^a-z0-9-]/gi, '-');
    const jsonName = `${name}.json`;
    const htmlName = `${name}.html`;
    try {
      const { lhr, report } = await lighthouse(new URL(target.path, base).href, {
        port,
        output: ['json', 'html'],
        logLevel: 'error',
        onlyCategories: ['seo'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
      }, {
        extends: 'lighthouse:default',
        settings: { onlyCategories: ['seo'], maxWaitForLoad: 30000, maxWaitForFcp: 15000 },
      });
      if (!lhr || !Array.isArray(report)) throw new Error('Lighthouse JSON/HTML raporu üretmedi.');
      await fs.writeFile(path.join(outputDir, jsonName), report[0], 'utf8');
      await fs.writeFile(path.join(outputDir, htmlName), report[1], 'utf8');
      const category = lhr.categories.seo;
      const score = typeof category?.score === 'number' ? Math.round(category.score * 100) : null;
      const auditIds = category?.auditRefs?.map(ref => ref.id) ?? [];
      const failures = auditIds.map(id => lhr.audits[id]).filter(audit => audit && audit.score !== null && audit.score < 1).map(audit => ({
        id: audit.id, title: audit.title, score: audit.score, description: audit.description,
        ...(audit.displayValue ? { displayValue: audit.displayValue } : {}),
        ...(audit.details ? { details: audit.details } : {}),
      }));
      const result = {
        path: target.path, title: target.title, status: category?.score === 1 && !lhr.runtimeError ? 'passed' : 'failed', score,
        auditCount: auditIds.length, failures, warnings: lhr.runWarnings ?? [],
        ...(lhr.runtimeError ? { runtimeError: lhr.runtimeError } : {}),
        reports: { json: jsonName, html: htmlName }, durationMs: Date.now() - started,
      };
      results.push(result);
      console.log(`${results.length}/${targets.length} ${target.path} SEO ${score ?? 'N/A'} ${result.status.toUpperCase()}${failures.length ? ` (${failures.map(audit => audit.id).join(', ')})` : ''}`);
    } catch (error) {
      const result = { path: target.path, title: target.title, status: 'failed', score: null, error: error.message, durationMs: Date.now() - started };
      results.push(result);
      // A failed run still gets a machine-readable page report.
      await fs.writeFile(path.join(outputDir, `${name}.error.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      console.error(`${results.length}/${targets.length} ${target.path} ERROR: ${error.message}`);
    }
  }
} catch (error) {
  runErrors.push(error.stack ?? error.message);
  console.error(error.message);
} finally {
  await browser?.close();
}

const failed = results.filter(result => result.status === 'failed');
const summary = {
  startedAt, finishedAt: new Date().toISOString(), base, chromePort: port,
  manifest: 'dist/site-manifest.json', category: 'seo', targetScore: 100,
  status: !runErrors.length && results.length === targets.length && targets.length > 0 && failed.length === 0 ? 'passed' : 'failed',
  totals: { manifestIndexablePages: targets.length, auditedPages: results.length, passed: results.length - failed.length, failed: failed.length },
  minimumScore: results.length && results.every(result => result.score !== null) ? Math.min(...results.map(result => result.score)) : null,
  results, errors: runErrors,
};
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`SEO ${summary.status.toUpperCase()}: ${summary.totals.passed}/${targets.length} sayfa 100. Rapor: output/lighthouse-seo/summary.json`);
process.exitCode = summary.status === 'passed' ? 0 : 1;
