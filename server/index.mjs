import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { env } from './node-env.mjs';
import { withRequest } from './node-auth.mjs';
import * as token from '../app/api/quote-token/route.ts';
import * as quotes from '../app/api/quotes/route.ts';
import * as adminQuotes from '../app/api/admin/quotes/route.ts';
import * as adminQuote from '../app/api/admin/quotes/[id]/route.ts';
import * as exportQuotes from '../app/api/admin/export/route.ts';

const root = path.resolve('generated/ssg');
const sourceOrigin = __SSG_ORIGIN__;
const compress = promisify(gzip);
const trustProxy = /^(true|1)$/i.test(process.env.TRUST_PROXY || '');
const configuredOrigin = process.env.SITE_ORIGIN ? validOrigin(process.env.SITE_ORIGIN) : null;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };
function validOrigin(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('SITE_ORIGIN must be an HTTP(S) origin.');
  return parsed.origin;
}
function lastHeader(value) { return String(Array.isArray(value) ? value.at(-1) : value || '').split(',').at(-1).trim(); }
function requestOrigin(request) {
  const host = lastHeader(trustProxy && request.headers['x-forwarded-host'] ? request.headers['x-forwarded-host'] : request.headers.host);
  if (!host || /[\s\\/@?#]/.test(host) || host.includes('..')) throw new Error('Invalid host.');
  const forwarded = trustProxy ? lastHeader(request.headers['x-forwarded-proto']) : '';
  const protocol = forwarded === 'https' ? 'https' : forwarded === 'http' ? 'http' : request.socket.encrypted ? 'https' : 'http';
  const fallback = validOrigin(`${protocol}://${host}`);
  return configuredOrigin || fallback;
}
function clientIp(request) {
  const forwarded = trustProxy ? lastHeader(request.headers['x-forwarded-for']) : '';
  return isIP(forwarded) ? forwarded : request.socket.remoteAddress || 'unknown';
}
async function bodyBytes(request) {
  if (Number(request.headers['content-length']) > 12288) { request.resume(); throw Object.assign(new Error('Body too large'), { status: 413 }); }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, failed = false;
    request.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > 12288) { failed = true; chunks.length = 0; reject(Object.assign(new Error('Body too large'), { status: 413 })); return; }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!failed) resolve(Buffer.concat(chunks)); });
    request.on('error', () => reject(new Error('Request interrupted')));
    request.on('aborted', () => reject(new Error('Request interrupted')));
  });
}
function apiJson(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
async function api(request, url) {
  const route = url.pathname.replace(/\/$/, '');
  if (route === '/api/health' && request.method === 'GET') return apiJson({ ok: true });
  if (route === '/api/runtime' && request.method === 'GET') return apiJson({ adminAuth: 'key' });
  const handlers = { '/api/quote-token': token, '/api/quotes': quotes, '/api/admin/quotes': adminQuotes, '/api/admin/export': exportQuotes };
  const item = /^\/api\/admin\/quotes\/([^/]+)$/.exec(route);
  const module = item ? adminQuote : handlers[route];
  if (!module) return apiJson({ ok: false, error: 'İşlem bulunamadı.' }, 404);
  const handler = module[request.method];
  if (typeof handler !== 'function') return apiJson({ ok: false, error: 'Bu yöntem desteklenmiyor.' }, 405);
  return withRequest(request, () => handler(request, { params: Promise.resolve({ id: item?.[1] }) }));
}
async function staticResponse(request, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
  if (/[\0\\]/.test(pathname)) return new Response('Bad request', { status: 400 });
  let filename = path.resolve(root, '.' + pathname);
  if (filename !== root && !filename.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
  let status = pathname === '/404.html' ? 404 : 200;
  let info = await stat(filename).catch(() => null);
  if (info?.isDirectory()) {
    if (!url.pathname.endsWith('/')) return new Response(null, { status: 308, headers: { Location: url.pathname + '/' + url.search } });
    filename = path.join(filename, 'index.html');
    info = await stat(filename).catch(() => null);
  }
  if (!info?.isFile()) { filename = path.join(root, '404.html'); status = 404; }
  let content = await readFile(filename);
  const extension = path.extname(filename).toLowerCase();
  if (['.html', '.xml', '.txt', '.json'].includes(extension)) content = Buffer.from(content.toString('utf8').split(sourceOrigin).join(url.origin));
  const headers = { 'Content-Type': mime[extension] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', Vary: 'Accept-Encoding' };
  const gzipAccepted = (request.headers.get('accept-encoding') || '').split(',').some(value => /^\s*gzip(?:\s*;|\s*$)/i.test(value) && !/;\s*q=0(?:\.0*)?\s*$/i.test(value));
  if (gzipAccepted && content.length > 1024 && /^(?:text\/|application\/(?:json|xml)|image\/svg)/.test(headers['Content-Type'])) {
    content = await compress(content); headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = String(content.length);
  return new Response(request.method === 'HEAD' ? null : content, { status, headers });
}
async function send(response, request, output) {
  output.statusCode = response.status;
  for (const [name, value] of response.headers) output.setHeader(name, value);
  if (request.method === 'HEAD' || !response.body) { output.end(); return; }
  const stream = Readable.fromWeb(response.body);
  output.on('close', () => stream.destroy());
  stream.on('error', () => output.destroy());
  stream.pipe(output);
}
const server = http.createServer(async (incoming, outgoing) => {
  try {
    if (!incoming.url?.startsWith('/') || incoming.url.startsWith('//') || /[\\\r\n]/.test(incoming.url)) throw new Error('Invalid URL');
    const origin = requestOrigin(incoming);
    const url = new URL(incoming.url, origin);
    if (url.origin !== origin) throw new Error('Invalid URL origin');
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value === undefined || name === 'cf-connecting-ip' || name.startsWith('oai-authenticated-user-')) continue;
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    headers.set('cf-connecting-ip', clientIp(incoming));
    const method = incoming.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await bodyBytes(incoming);
    const request = new Request(url, { method, headers, ...(body !== undefined ? { body } : {}) });
    const response = url.pathname.startsWith('/api/') ? await api(request, url) : await staticResponse(request, url);
    await send(response, request, outgoing);
  } catch (error) {
    const status = error.status === 413 ? 413 : 400;
    await send(apiJson({ ok: false, error: status === 413 ? 'Gönderilen bilgiler boyut sınırını aşıyor.' : 'İstek tamamlanamadı.' }, status), { method: incoming.method }, outgoing);
  }
});
server.requestTimeout = 20000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000;
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Yapı Malzemecim Node server listening on port ${server.address().port}`));
function shutdown() { server.close(() => { env.DB.close(); process.exit(0); }); setTimeout(() => process.exit(0), 5000).unref(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
