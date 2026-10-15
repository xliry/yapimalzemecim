import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

class Statement {
  constructor(owner, sql, values = []) { this.owner = owner; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.owner, this.sql, values); }
  execute() {
    const started = performance.now();
    const results = this.owner.sqlite.prepare(this.sql).all(...this.values);
    const meta = this.owner.sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get();
    return { results, success: true, meta: { changes: Number(meta.changes), last_row_id: Number(meta.last_row_id), duration: performance.now() - started } };
  }
  async all() { return this.execute(); }
  async first(column) {
    const row = this.owner.sqlite.prepare(this.sql).get(...this.values);
    return row ? (column ? row[column] ?? null : row) : null;
  }
  async run() { return this.execute(); }
  async raw() { return this.execute().results.map(row => Object.values(row)); }
}

export function openD1(filename, migrationsDirectory) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS __node_migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  for (const name of readdirSync(migrationsDirectory).filter(name => /^\d.*\.sql$/.test(name)).sort()) {
    const sql = readFileSync(path.join(migrationsDirectory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const applied = sqlite.prepare('SELECT checksum FROM __node_migrations WHERE name = ?').get(name);
      if (applied && applied.checksum !== checksum) throw new Error('An applied database migration has changed.');
      if (!applied) {
        sqlite.exec(sql);
        sqlite.prepare('INSERT INTO __node_migrations (name, checksum, applied_at) VALUES (?, ?, ?)').run(name, checksum, Date.now());
      }
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); sqlite.close(); throw error; }
  }
  return {
    sqlite,
    prepare(sql) { return new Statement(this, sql); },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const results = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); },
  };
}
