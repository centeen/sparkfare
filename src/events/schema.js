// N12: the typed columns of `events`. The Worker adds them on first use if migration 0044 has not been applied, so deploying before the migration cannot lose events.
const READY = new WeakSet();
export async function ensureEventColumns(env) {
  if (!env?.DB || READY.has(env.DB)) return;
  for (const sql of ['ALTER TABLE events ADD COLUMN ua_class TEXT', 'ALTER TABLE events ADD COLUMN schema_version INTEGER DEFAULT 1']) {
    try { await env.DB.prepare(sql).run(); } catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
  }
  READY.add(env.DB);
}
