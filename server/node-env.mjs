import path from 'node:path';
import { openD1 } from './sqlite-d1.mjs';
for (const name of ['FORM_SIGNING_KEY', 'ADMIN_ACCESS_KEY']) {
  if (!process.env[name] || process.env[name].length < 32) throw new Error(`${name} must contain at least 32 characters.`);
}
export const env = {
  DB: openD1(path.resolve(process.env.DB_PATH || '/app/data/quotes.sqlite'), path.resolve('drizzle')),
  FORM_SIGNING_KEY: process.env.FORM_SIGNING_KEY,
  ADMIN_ACCESS_KEY: process.env.ADMIN_ACCESS_KEY,
};
