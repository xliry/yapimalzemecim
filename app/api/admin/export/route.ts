import { database, fail, requireAdmin } from '../../_lib';
export const dynamic = 'force-dynamic';
function csv(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = database();
    const columns = ['reference', 'created_at', 'status', 'name', 'company', 'phone', 'email', 'product', 'thickness', 'quantity', 'unit', 'city', 'details'];
    const encoder = new TextEncoder();
    const snapshot = Date.now();
    let cursor: { time: number; id: string } | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(encoder.encode('\ufeff' + columns.map(csv).join(',') + '\r\n')); },
      async pull(controller) {
        try {
          const fields = 'id, ' + columns.join(', ');
          const query = cursor
            ? db.prepare(`SELECT ${fields} FROM quotes WHERE created_at <= ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 200`).bind(snapshot, cursor.time, cursor.time, cursor.id)
            : db.prepare(`SELECT ${fields} FROM quotes WHERE created_at <= ? ORDER BY created_at DESC, id DESC LIMIT 200`).bind(snapshot);
          const { results } = await query.all();
          if (!results.length) { controller.close(); return; }
          const lines = results.map(row => columns.map(column => csv(column === 'created_at' ? new Date(Number(row[column])).toISOString() : row[column])).join(','));
          controller.enqueue(encoder.encode(lines.join('\r\n') + '\r\n'));
          const last = results[results.length - 1];
          cursor = { time: Number(last.created_at), id: String(last.id) };
          if (results.length < 200) controller.close();
        } catch { controller.error(new Error('CSV export could not be completed.')); }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="yapi-malzemecim-talepler.csv"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return fail(error); }
}
