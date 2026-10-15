import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  status: text('status', { enum: ['new', 'contacted', 'quoted', 'closed'] }).notNull().default('new'),
  name: text('name').notNull(),
  company: text('company').notNull().default(''),
  phone: text('phone').notNull(),
  email: text('email').notNull().default(''),
  product: text('product').notNull(),
  thickness: text('thickness').notNull().default(''),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  city: text('city').notNull(),
  details: text('details').notNull().default(''),
  requestId: text('request_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  privacyNoticeVersion: text('privacy_notice_version').notNull(),
}, table => [
  uniqueIndex('quotes_reference_unique').on(table.reference),
  uniqueIndex('quotes_request_id_unique').on(table.requestId),
  index('quotes_created_id_idx').on(table.createdAt, table.id),
  check('quotes_status_allowed', sql`${table.status} IN ('new','contacted','quoted','closed')`),
  check('quotes_quantity_positive', sql`${table.quantity} > 0 AND ${table.quantity} <= 1000000`),
]);

export const quoteRateLimits = sqliteTable('quote_rate_limits', {
  key: text('key').notNull(),
  bucket: integer('bucket').notNull(),
  count: integer('count').notNull().default(0),
}, table => [primaryKey({ columns: [table.key, table.bucket] })]);
