import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../chatgpt-auth';

export const BODY_LIMIT = 12 * 1024;
export const STATUSES = ['new', 'contacted', 'quoted', 'closed'] as const;
const encoder = new TextEncoder();
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
export function fail(error: unknown) {
  if (error instanceof ApiError) return json({ ok: false, error: error.message }, error.status, error.status === 429 ? { 'Retry-After': '600' } : {});
  return json({ ok: false, error: 'İşlem şu anda tamamlanamadı. Lütfen yeniden deneyin.' }, 503);
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Bu kaynaktan gönderim kabul edilmiyor.');
  }
}
export function database() {
  if (!env.DB) throw new ApiError(503, 'Talep sistemi şu anda kullanılamıyor.');
  return env.DB;
}
function signingSecret() {
  if (!env.FORM_SIGNING_KEY || env.FORM_SIGNING_KEY.length < 32) throw new ApiError(503, 'Talep sistemi şu anda kullanılamıyor.');
  return env.FORM_SIGNING_KEY;
}
function base64url(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decode64(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Malformed token');
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}
async function hmacKey() {
  return crypto.subtle.importKey('raw', encoder.encode(signingSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function digest(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(value))));
}
export async function issueToken() {
  const payload = base64url(encoder.encode(JSON.stringify({ issued: Math.floor(Date.now() / 1000), nonce: crypto.randomUUID() })));
  return `${payload}.${await digest(`form:${payload}`)}`;
}
export async function verifyToken(token: unknown) {
  if (typeof token !== 'string' || token.length > 512) throw new ApiError(403, 'Form oturumu geçersiz. Sayfayı yenileyip yeniden deneyin.');
  const key = await hmacKey();
  try {
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error('Malformed token');
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify('HMAC', key, decode64(signature), encoder.encode(`form:${payload}`))) throw new Error('Invalid signature');
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode64(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(data.issued) || data.issued > now + 60 || now - data.issued > 1800 || !isUuid(data.nonce)) throw new Error('Expired token');
  } catch {
    throw new ApiError(403, 'Form oturumu sona erdi veya doğrulanamadı. Sayfayı yenileyip yeniden deneyin.');
  }
}
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new ApiError(415, 'JSON biçiminde veri gönderin.');
  const length = Number(request.headers.get('content-length'));
  if (length > BODY_LIMIT) throw new ApiError(413, 'Gönderilen bilgiler boyut sınırını aşıyor.');
  if (!request.body) throw new ApiError(400, 'Form bilgileri eksik.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); throw new ApiError(413, 'Gönderilen bilgiler boyut sınırını aşıyor.'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try {
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Object required');
    return data;
  } catch { throw new ApiError(400, 'Form bilgileri okunamadı.'); }
}
function field(data: Record<string, unknown>, key: string, max: number, required = false) {
  const raw = data[key];
  if (raw !== undefined && typeof raw !== 'string') throw new ApiError(400, 'Form alanlarını kontrol edin.');
  const value = (raw as string | undefined)?.trim().normalize('NFC') ?? '';
  if (value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value)) throw new ApiError(400, 'Form alanlarını kontrol edin.');
  return value;
}
export function quoteFields(data: Record<string, unknown>) {
  if (data.consent !== true || (data.website !== undefined && data.website !== '')) throw new ApiError(400, 'Form bilgilerini ve gizlilik onayını kontrol edin.');
  if (!isUuid(data.requestId)) throw new ApiError(400, 'Talep kimliği geçersiz. Sayfayı yenileyin.');
  const name = field(data, 'name', 100, true), company = field(data, 'company', 150);
  const phone = field(data, 'phone', 25, true), email = field(data, 'email', 150);
  const product = field(data, 'product', 30, true), thickness = field(data, 'thickness', 100);
  const unit = field(data, 'unit', 10, true), city = field(data, 'city', 100, true), details = field(data, 'details', 3000);
  const quantity = typeof data.quantity === 'number' || typeof data.quantity === 'string' ? Number(data.quantity) : NaN;
  const digits = phone.replace(/\D/g, '');
  if (name.length < 2 || !/^[+\d\s().-]+$/.test(phone) || digits.length < 10 || digits.length > 15 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new ApiError(400, 'Adınızı, telefonunuzu ve e-postanızı kontrol edin.');
  if (!['plywood', 'kontrplak', 'osb', 'kereste', 'ahsap-kalip-kirisi', 'diger'].includes(product) || !['adet', 'm²', 'm³', 'metre'].includes(unit) || !Number.isFinite(quantity) || quantity < 0.01 || quantity > 1000000) throw new ApiError(400, 'Ürün, miktar ve birim bilgilerini kontrol edin.');
  return { requestId: data.requestId, name, company, phone, email, product, thickness, quantity, unit, city, details };
}
export async function requireAdmin(request: Request) {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, 'Yönetim için ChatGPT ile giriş yapın.');
  const secret = env.ADMIN_ACCESS_KEY;
  if (!secret || secret.length < 32) throw new ApiError(503, 'Yönetim erişimi henüz yapılandırılmadı.');
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') || '');
  const supplied = match?.[1] || '';
  if (supplied.length > 256) throw new ApiError(403, 'Yönetim anahtarı doğrulanamadı.');
  const [actual, expected] = await Promise.all([supplied, secret].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(actual), right = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  if (difference !== 0) throw new ApiError(403, 'Yönetim anahtarı doğrulanamadı.');
  return user;
}
export function reference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'YM-' + [...crypto.getRandomValues(new Uint8Array(8))].map(byte => alphabet[byte % alphabet.length]).join('');
}
