import { test } from 'node:test';
import assert from 'node:assert/strict';

// Run against the local Vinext dev server after applying the local D1 migration.
// API_TEST_ADMIN_KEY is supplied through environment, never a CLI argument.
const base = new URL(process.env.API_TEST_BASE_URL || 'http://127.0.0.1:4173');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('API tests only write to a loopback preview.');
const adminKey = process.env.API_TEST_ADMIN_KEY || '';
const cookie = process.env.API_TEST_AUTH_COOKIE || '__sites_local_auth=1';
const origin = base.origin;
const url = path => new URL(path, base);
const auth = () => ({ Cookie: cookie, Authorization: `Bearer ${adminKey}` });
const body = token => ({ token, requestId: crypto.randomUUID(), name: 'Yerel API testi', company: 'TEST — gerçek müşteri değildir', phone: '+90 000 000 00 00', email: 'qa@example.invalid', product: 'plywood', thickness: '18 mm', quantity: 42, unit: 'adet', city: 'Test şehri', details: '=HYPERLINK("https://example.invalid","test")', consent: true, website: '' });
const submit = (payload, options = {}) => fetch(url('/api/quotes'), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...options.headers }, body: JSON.stringify(payload) });
let token, saved, fixture;

await test('public token is short lived, signed and never cached', async () => {
  const response = await fetch(url('/api/quote-token'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  ({ token } = await response.json());
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const data = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(typeof data.issued, 'number');
  assert.ok(Math.abs(Date.now() / 1000 - data.issued) < 60);
  assert.equal(typeof data.nonce, 'string');
  assert.deepEqual(Object.keys(data).sort(), ['issued', 'nonce']);
});

await test('no public quote listing and unauthenticated admin access is rejected', async () => {
  const list = await fetch(url('/api/quotes'));
  assert.equal(list.status, 405);
  const admin = await fetch(url('/api/admin/quotes'));
  assert.equal(admin.status, 401);
  assert.equal((await admin.json()).ok, false);
  const exportResponse = await fetch(url('/api/admin/export'));
  assert.equal(exportResponse.status, 401);
});

await test('cross-origin writes, invalid form data, unsigned tokens and oversized bodies are rejected', async () => {
  const payload = body(token);
  assert.equal((await submit(payload, { headers: { Origin: 'https://elsewhere.invalid' } })).status, 403);
  const noOrigin = await fetch(url('/api/quotes'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(noOrigin.status, 403);
  for (const invalid of [{ ...payload, consent: false }, { ...payload, website: 'spam' }, { ...payload, quantity: -1 }, { ...payload, product: 'injected-product' }, { ...payload, phone: 'wrong' }, { ...payload, requestId: 'not-a-uuid' }]) {
    assert.equal((await submit(invalid)).status, 400);
  }
  assert.equal((await submit({ ...payload, token: `${token.split('.')[0]}.invalid` })).status, 403);
  assert.equal((await submit({ ...payload, details: 'a'.repeat(14000) })).status, 413);
});

await test('valid submission is durable and an identical request is idempotent', async () => {
  fixture = body(token);
  const response = await submit(fixture);
  assert.equal(response.status, 201);
  saved = await response.json();
  assert.equal(saved.ok, true);
  assert.match(saved.reference, /^YM-[A-Z2-9]{8}$/);
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  const repeated = await submit(fixture);
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), saved);
  const changed = await submit({ ...fixture, quantity: 43 });
  assert.equal(changed.status, 409);
});

await test('authenticated admin still needs the server access key', async () => {
  const response = await fetch(url('/api/admin/quotes'), { headers: { Cookie: cookie, Authorization: 'Bearer invalid' } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).ok, false);
});

await test('admin reads persisted record, updates status and exports safe CSV', { skip: !adminKey && 'Set API_TEST_ADMIN_KEY in the environment to verify protected lifecycle.' }, async () => {
  const response = await fetch(url('/api/admin/quotes?limit=100'), { headers: auth() });
  assert.equal(response.status, 200);
  const data = await response.json();
  const record = data.quotes.find(row => row.id === saved.id);
  assert.ok(record);
  assert.equal(record.name, fixture.name);
  assert.equal(record.quantity, fixture.quantity);
  assert.equal(record.reference, saved.reference);
  assert.equal(Object.hasOwn(record, 'payloadHash'), false);
  assert.equal(Object.hasOwn(record, 'payload_hash'), false);
  assert.equal(Object.hasOwn(record, 'request_id'), false);
  const patch = (status, requestOrigin = origin) => fetch(url(`/api/admin/quotes/${saved.id}`), { method: 'PATCH', headers: { ...auth(), Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  assert.equal((await patch('contacted', 'https://elsewhere.invalid')).status, 403);
  assert.equal((await patch('invalid')).status, 400);
  assert.equal((await patch('contacted')).status, 200);
  const updated = await fetch(url('/api/admin/quotes?limit=100'), { headers: auth() });
  assert.equal((await updated.json()).quotes.find(row => row.id === saved.id).status, 'contacted');
  const csv = await fetch(url('/api/admin/export'), { headers: auth() });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') || '', /text\/csv/);
  const text = await csv.text();
  assert.ok(text.includes(saved.reference));
  assert.ok(text.includes('"\'=HYPERLINK('));
  const invalidCursor = await fetch(url('/api/admin/quotes?before=invalid'), { headers: auth() });
  assert.equal(invalidCursor.status, 400);
});

await test('rate limit accepts five new requests per ten-minute bucket', { skip: process.env.API_TEST_RATE_LIMIT !== '1' && 'Optional: enable on a fresh local database with API_TEST_RATE_LIMIT=1.' }, async () => {
  // The durable-submission test above has consumed one slot for this local IP.
  for (let index = 0; index < 4; index++) assert.equal((await submit(body(token))).status, 201);
  const limited = await submit(body(token));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '600');
  assert.equal((await submit(fixture)).status, 200, 'Existing idempotent request remains readable after rate limit.');
});
