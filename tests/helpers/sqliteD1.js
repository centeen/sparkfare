import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// A D1-shaped wrapper over a real in-memory SQLite database, so tests run the repo's actual
// migration SQL and queries instead of a hand-written mock.
export function makeSqliteD1(migrationFiles = []) {
  const db = new DatabaseSync(':memory:');
  for (const file of migrationFiles) db.exec(fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));

  const statement = (sql, params = []) => ({
    bind: (...next) => statement(sql, next),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => {
      db.prepare(sql).run(...params);
      return { success: true };
    },
  });

  return { prepare: (sql) => statement(sql), raw: db };
}
