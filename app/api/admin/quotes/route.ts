import { ApiError, database, fail, json, requireAdmin } from '../../_lib';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 25);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, 'Sayfa boyutu geçersiz.');
    const before = url.searchParams.get('before');
    let cursor: { time: number; id: string } | null = null;
    if (before) {
      const match = /^(\d{10,16}):([0-9a-f-]{36})$/i.exec(before);
      if (!match || !Number.isSafeInteger(Number(match[1]))) throw new ApiError(400, 'Sayfalama bilgisi geçersiz.');
      cursor = { time: Number(match[1]), id: match[2] };
    }
    const columns = 'id, reference, created_at AS createdAt, updated_at AS updatedAt, status, name, company, phone, email, product, thickness, quantity, unit, city, details, privacy_notice_version AS privacyNoticeVersion';
    const statement = cursor
      ? database().prepare(`SELECT ${columns} FROM quotes WHERE (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?`).bind(cursor.time, cursor.time, cursor.id, limit + 1)
      : database().prepare(`SELECT ${columns} FROM quotes ORDER BY created_at DESC, id DESC LIMIT ?`).bind(limit + 1);
    const { results } = await statement.all();
    const rows = results.slice(0, limit);
    const last = rows.at(-1);
    return json({ ok: true, quotes: rows, nextCursor: results.length > limit && last ? `${last.createdAt}:${last.id}` : null });
  } catch (error) { return fail(error); }
}
