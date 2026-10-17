import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { openD1 } from '../server/sqlite-d1.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'ym-node-test-'));
const adminKey = randomBytes(32).toString('hex'), formKey = randomBytes(32).toString('hex');
let child, base, externalOrigin, token, fixture, saved;
async function start(origin = '') {
  child = spawn(process.execPath, ['generated/node-server.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: '0', DB_PATH: path.join(directory, 'quotes.sqlite'), ADMIN_ACCESS_KEY: adminKey, FORM_SIGNING_KEY: formKey, SITE_ORIGIN: origin, TRUST_PROXY: 'false', NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Node server startup timeout')), 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = /listening on port (\d+)/.exec(output);
      if (match) { clearTimeout(timeout); base = `http://127.0.0.1:${match[1]}`; externalOrigin = origin || base; resolve(); }
    });
    child.once('error', () => { clearTimeout(timeout); reject(new Error('Node server startup failed')); });
    child.once('exit', code => { if (!base || code) { clearTimeout(timeout); reject(new Error('Node server exited during startup')); } });
  });
}
async function stop() { if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; } }
const auth = () => ({ Authorization: `Bearer ${adminKey}` });
const submit = (data, headers = {}) => fetch(base + '/api/quotes', { method: 'POST', headers: { Origin: externalOrigin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });

try {
  await test('SQLite D1 batch rolls back atomically and migration journal is stable', async () => {
    const db = openD1(path.join(directory, 'adapter.sqlite'), path.resolve('drizzle'));
    await assert.rejects(db.batch([db.prepare('INSERT INTO quote_rate_limits (key,bucket,count) VALUES (?,?,?)').bind('rollback', 1, 1), db.prepare('INSERT INTO missing_table VALUES (1)')]));
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM quote_rate_limits').first()).count, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM __node_migrations').first()).count, 1);
    db.close();
    const reopened = openD1(path.join(directory, 'adapter.sqlite'), path.resolve('drizzle'));
    assert.equal((await reopened.prepare('SELECT COUNT(*) AS count FROM __node_migrations').first()).count, 1);
    reopened.close();
  });
  await start();
  await test('standalone health, runtime, static HTML, HEAD, gzip and directory redirects', async () => {
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true });
    assert.deepEqual(await (await fetch(base + '/api/runtime')).json(), { adminAuth: 'key' });
    const response = await fetch(base + '/', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-encoding'), 'gzip');
    const html = await response.text(); assert.ok(html.includes(`rel="canonical" href="${base}/"`));
    const head = await fetch(base + '/', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const redirect = await fetch(base + '/urunler?campaign=test', { redirect: 'manual' }); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/urunler/?campaign=test');
    assert.equal((await fetch(base + '/unknown-page/')).status, 404);
    assert.equal((await fetch(base + '/404.html')).status, 404);
    const traversal = await fetch(base + '/%2e%2e%2f.dev.vars'); assert.ok([403, 404].includes(traversal.status));
    const invalidPath = await new Promise((resolve, reject) => { const request = http.get(base, { path: '/\\evil.invalid/api/health' }, response => { response.resume(); resolve(response.statusCode); }); request.on('error', reject); });
    assert.equal(invalidPath, 400);
  });
  await test('shared API records a new timber beam product and rejects unknown products', async () => {
    ({ token } = await (await fetch(base + '/api/quote-token')).json());
    fixture = { token, requestId: crypto.randomUUID(), name: 'Yerel Node testi', company: 'TEST', phone: '+90 000 000 00 00', email: 'qa@example.invalid', product: 'ahsap-kalip-kirisi', thickness: '2,90 m', quantity: 12, unit: 'adet', city: 'Test', details: '=1+1', consent: true, website: '' };
    assert.equal((await submit(fixture, { Origin: 'https://other.invalid' })).status, 403);
    assert.equal((await submit({ ...fixture, details: 'x'.repeat(15000) })).status, 413);
    const unknownProduct = await submit({ ...fixture, product: 'unknown-product', requestId: crypto.randomUUID() });
    assert.equal(unknownProduct.status, 400); assert.equal((await unknownProduct.json()).ok, false);
    const created = await submit(fixture); assert.equal(created.status, 201); saved = await created.json(); assert.equal(saved.ok, true);
    assert.deepEqual(await (await submit(fixture)).json(), saved);
    assert.equal((await submit({ ...fixture, quantity: 13 })).status, 409);
    assert.equal((await fetch(base + '/api/quotes')).status, 405);
  });
  await test('Node management requires its key and works without ChatGPT cookies', async () => {
    assert.equal((await fetch(base + '/api/admin/quotes')).status, 401);
    assert.equal((await fetch(base + '/api/admin/quotes', { headers: { Authorization: 'Bearer wrong' } })).status, 403);
    const response = await fetch(base + '/api/admin/quotes', { headers: auth() }); assert.equal(response.status, 200);
    const stored = (await response.json()).quotes.find(row => row.id === saved.id);
    assert.equal(stored.name, fixture.name); assert.equal(stored.product, 'ahsap-kalip-kirisi'); assert.equal(stored.thickness, fixture.thickness); assert.equal(stored.quantity, fixture.quantity); assert.equal(stored.unit, fixture.unit);
    const patch = await fetch(base + `/api/admin/quotes/${saved.id}`, { method: 'PATCH', headers: { ...auth(), Origin: externalOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'quoted' }) }); assert.equal(patch.status, 200);
    const exported = await fetch(base + '/api/admin/export', { headers: auth() }); assert.equal(exported.status, 200);
    const csv = await exported.text(); assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('"ahsap-kalip-kirisi","2,90 m","12","adet"'));
  });
  await test('untrusted forwarded and Cloudflare IP headers cannot bypass the rate limit', async () => {
    for (let index = 0; index < 4; index++) assert.equal((await submit({ ...fixture, requestId: crypto.randomUUID() })).status, 201);
    assert.equal((await submit({ ...fixture, requestId: crypto.randomUUID() })).status, 429);
    assert.equal((await submit({ ...fixture, requestId: crypto.randomUUID() }, { 'CF-Connecting-IP': '192.0.2.10', 'X-Forwarded-For': '192.0.2.20' })).status, 429);
  });
  await stop(); await start('https://coolify.example.test');
  await test('restart preserves SQLite leads and runtime origin rewrites SEO files', async () => {
    const response = await fetch(base + '/api/admin/quotes', { headers: auth() }); const data = await response.json();
    assert.equal(data.quotes.length, 5);
    const restored = data.quotes.find(row => row.id === saved.id); assert.equal(restored.status, 'quoted'); assert.equal(restored.product, 'ahsap-kalip-kirisi');
    assert.deepEqual(await (await submit(fixture)).json(), saved);
    for (const file of ['/', '/sitemap.xml', '/robots.txt', '/llms.txt', '/llms-full.txt']) {
      const response = await fetch(base + file); assert.equal(response.status, 200); const text = await response.text(); assert.ok(text.includes('https://coolify.example.test')); assert.ok(!text.includes('https://yapi-malzemecim.uoma361.chatgpt.site'));
    }
    assert.equal((await submit(fixture, { Origin: base })).status, 403);
  });
  await test('missing production secrets fail startup', async () => {
    const processWithoutSecret = spawn(process.execPath, ['generated/node-server.mjs'], { env: { ...process.env, NODE_ENV: 'production', ADMIN_ACCESS_KEY: '', FORM_SIGNING_KEY: formKey }, stdio: ['ignore', 'ignore', 'ignore'] });
    const [code] = await once(processWithoutSecret, 'exit'); assert.notEqual(code, 0);
  });
} finally { await stop(); await rm(directory, { recursive: true, force: true }); }
