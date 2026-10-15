import { fail, issueToken, json } from '../_lib';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return json({ token: await issueToken() }); }
  catch (error) { return fail(error); }
}
