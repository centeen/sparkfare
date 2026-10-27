import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// A D1-shaped wrapper over a real in-memory SQLite database, so tests run the repo's actual
// migration SQL and queries instead of a hand-written mock.
export function makeSqliteD1(migrationFiles = []) {
  const db = new DatabaseSync(':memory:');
  for (const file of migrationFiles) db.exec(fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));

  const statement = (sql, params = []) => ({
    sql, params,
    bind: (...next) => statement(sql, next),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => {
      const result = db.prepare(sql).run(...params);
      // D1 reports how many rows a write changed (meta.changes); code such as the pause rule and the send budget relies on it.
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });

  // D1's batch: the statements run in one transaction and all roll back if one fails.
  const batch = async (statements) => {
    db.exec('BEGIN');
    try {
      for (const st of statements) db.prepare(st.sql).run(...st.params);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return statements.map(() => ({ success: true }));
  };

  return { prepare: (sql) => statement(sql), batch, raw: db };
}
