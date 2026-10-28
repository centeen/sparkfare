// N12: the typed columns of `events`. The Worker adds them on first use if migration 0044 has not been applied, so deploying before the migration cannot lose events.
const READY = new WeakSet();
export async function ensureEventColumns(env) {
  if (!env?.DB || READY.has(env.DB)) return;
  for (const sql of ['ALTER TABLE events ADD COLUMN ua_class TEXT', 'ALTER TABLE events ADD COLUMN schema_version INTEGER DEFAULT 1']) {
    try { await env.DB.prepare(sql).run(); } catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
  }
  READY.add(env.DB);
}

/** True when an INSERT failed only because the typed columns are not there yet (migration 0044 not applied and this table predates the inline CREATE). */
export const isMissingEventColumn = (error) => /ua_class|schema_version/.test(String(error?.message || error)) && /no such column|has no column|no column named/i.test(String(error?.message || error));

/** After an INSERT failed: if it was only the missing typed columns, add them and run the insert again; any other error is rethrown. Keeping the common path free of
 *  wrappers matters: callers that fire-and-forget (ctx.waitUntil) are timing-sensitive in tests, and the happy path should cost no extra round trip. */
export async function retryWithEventColumns(env, error, insert) {
  if (!isMissingEventColumn(error)) throw error;
  await ensureEventColumns(env);
  return insert();
}
