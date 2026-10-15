import { ApiError, database, fail, isUuid, json, readJson, requireAdmin, sameOrigin, STATUSES } from '../../../_lib';
export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    await requireAdmin(request);
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, 'Talep kimliği geçersiz.');
    const data = await readJson(request);
    if (typeof data.status !== 'string' || !STATUSES.includes(data.status as typeof STATUSES[number])) throw new ApiError(400, 'Talep durumu geçersiz.');
    const updated = await database().prepare('UPDATE quotes SET status = ?, updated_at = ? WHERE id = ? RETURNING id, reference, status, updated_at AS updatedAt').bind(data.status, Date.now(), id).first();
    if (!updated) throw new ApiError(404, 'Talep bulunamadı.');
    return json({ ok: true, quote: updated });
  } catch (error) { return fail(error); }
}
