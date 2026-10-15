import { getChatGPTUser } from '../../chatgpt-auth';
import { ApiError, database, digest, fail, json, quoteFields, readJson, reference, sameOrigin, verifyToken } from '../_lib';
export const dynamic = 'force-dynamic';
type Existing = { id: string; reference: string; payload_hash: string };
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const payload = await readJson(request);
    const fields = quoteFields(payload);
    await verifyToken(payload.token);
    const db = database();
    const hash = await digest(`payload:${JSON.stringify(fields)}`);
    const existing = await db.prepare('SELECT id, reference, payload_hash FROM quotes WHERE request_id = ?').bind(fields.requestId).first<Existing>();
    if (existing) {
      if (existing.payload_hash !== hash) throw new ApiError(409, 'Bu talep kimliği daha önce farklı bilgilerle kullanıldı. Sayfayı yenileyin.');
      return json({ ok: true, reference: existing.reference, id: existing.id });
    }
    const user = await getChatGPTUser();
    const identity = user?.userId ? `user:${user.userId}` : `ip:${request.headers.get('cf-connecting-ip') || 'unknown'}`;
    const rateKey = await digest(`rate:${identity}`);
    const bucket = Math.floor(Date.now() / 600000);
    const reservation = await db.prepare('INSERT INTO quote_rate_limits (key, bucket, count) VALUES (?, ?, 1) ON CONFLICT(key, bucket) DO UPDATE SET count = count + 1 WHERE count < 5 RETURNING count').bind(rateKey, bucket).first<{ count: number }>();
    if (!reservation) throw new ApiError(429, 'Kısa sürede çok sayıda talep gönderdiniz. Lütfen 10 dakika sonra yeniden deneyin.');
    const id = crypto.randomUUID(), now = Date.now(), ref = reference();
    const result = await db.batch([
      db.prepare('INSERT INTO quotes (id, reference, created_at, updated_at, status, name, company, phone, email, product, thickness, quantity, unit, city, details, request_id, payload_hash, privacy_notice_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING').bind(id, ref, now, now, 'new', fields.name, fields.company, fields.phone, fields.email, fields.product, fields.thickness, fields.quantity, fields.unit, fields.city, fields.details, fields.requestId, hash, '2026-10-15'),
      db.prepare('SELECT id, reference, payload_hash FROM quotes WHERE request_id = ?').bind(fields.requestId),
      db.prepare('DELETE FROM quote_rate_limits WHERE bucket < ?').bind(bucket - 6),
    ]);
    const saved = result[1].results[0] as Existing | undefined;
    if (!saved) throw new ApiError(503, 'Talebiniz kaydedilemedi. Lütfen yeniden deneyin.');
    if (saved.payload_hash !== hash) throw new ApiError(409, 'Bu talep kimliği daha önce farklı bilgilerle kullanıldı. Sayfayı yenileyin.');
    return json({ ok: true, reference: saved.reference, id: saved.id }, saved.id === id ? 201 : 200);
  } catch (error) { return fail(error); }
}
