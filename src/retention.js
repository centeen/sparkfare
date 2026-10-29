// Addendum N, N13 (DR-22, Framework 5.4): retention and deletion jobs. DARK: nothing here runs unless ENABLE_RETENTION_JOBS is "true", and even then it only COUNTS
// (a dry run, written to the Monday brief) until RETENTION_DRY_RUN is set to the exact string "false". The first real run waits for the Hub's Guard read of the
// retention paragraph in /privacy (claude/guard_read_package_N13_retention_2026-10-28.md).
//
// What it does, per Framework 5.4 (values approved as D-042):
//   1. Events older than 13 months are rolled into events_monthly_agg (month, event type, visitor class, count) and then deleted, in one batch.
//   2. Delivery-log rows are deleted 90 days after their send.
//   3. A subscriber's personal fields are removed 30 days after they unsubscribe, after the sunset pause, or after a deletion request: the users row is kept (so
//      trips and counts keep their ids) but made anonymous, and the person's watchlists, plans, push subscriptions, waitlist entry and email-keyed delivery rows
//      are deleted. The suppression entry (email_suppressions) and the consent record (consent_log) are KEPT: they are how we honour and prove the opt-out.
//   4. Payouts and trip rows are never touched; a trip keeps its counts, and its link to a person ends because the user row no longer identifies anyone.
// Backups roll off on their own schedule (14 daily, 12 monthly), so a deletion leaves them by roll-off.
import { logEvent } from './index.js';

export const RETENTION = { eventMonths: 13, deliveryDays: 90, personalDays: 30, maxUsersPerRun: 500 };

export const retentionEnabled = (env) => env?.ENABLE_RETENTION_JOBS === 'true';
/** Real deletion needs BOTH flags: the job on and the dry-run switch explicitly "false". Anything else counts only. */
export const retentionIsDryRun = (env) => env?.RETENTION_DRY_RUN !== 'false';

/** [table, timestamp column, whether the column holds a date only]. Rows older than RETENTION.deliveryDays are deleted. */
export const DELIVERY_LOGS = [
  ['daily_alert_deliveries', 'delivered_on'],
  ['stress_valve_deliveries', 'created_at'],
  ['departure_briefing_deliveries', 'created_at'],
  ['departing_soon_deliveries', 'created_at'],
  ['route_retrospective_deliveries', 'created_at'],
  ['pre_departure_sequence_deliveries', 'created_at'],
  ['away_mode_email_log', 'sent_at'],
  ['digest_sent_snapshots', 'sent_on'],
  ['purchase_email_queue', 'created_at'],
];
/** Delivery tables keyed by the person's email: their rows go with the person. */
const EMAIL_KEYED = ['daily_alert_deliveries', 'stress_valve_deliveries', 'departure_briefing_deliveries', 'departing_soon_deliveries', 'route_retrospective_deliveries',
  'pre_departure_sequence_deliveries', 'away_mode_email_log', 'purchase_email_queue', 'email_send_ledger'];

const sqlTs = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const monthsAgo = (now, n) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
const daysAgo = (now, n) => new Date(now.getTime() - n * 86400000);

let READY = new WeakSet();
export async function ensureRetentionSchema(env) {
  if (!env?.DB || READY.has(env.DB)) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS events_monthly_agg (month TEXT NOT NULL, event_type TEXT NOT NULL, ua_class TEXT NOT NULL DEFAULT \'\', n INTEGER NOT NULL, PRIMARY KEY (month, event_type, ua_class))').run();
  for (const col of ['sunset_at TEXT', 'deletion_requested_at TEXT', 'anonymized_at TEXT']) {
    try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch (e) { if (!/duplicate column/i.test(String(e?.message || e))) throw e; }
  }
  READY.add(env.DB);
}
export function _resetRetentionForTests() { READY = new WeakSet(); }

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").bind(name).first();
  return Boolean(row);
}
const count = async (env, sql, binds = []) => Number((await env.DB.prepare(sql).bind(...binds).first())?.n || 0);

// The people whose personal data is due to go: unsubscribed, sunset-paused or asked for deletion at least personalDays ago, not already anonymous, never a paying member.
const DUE_USERS = `anonymized_at IS NULL AND COALESCE(subscription_tier, 'free') != 'paid' AND (
  (unsubscribed_at IS NOT NULL AND unsubscribed_at <= ?)
  OR (sunset_at IS NOT NULL AND is_subscribed = 0 AND sunset_at <= ?)
  OR (deletion_requested_at IS NOT NULL AND deletion_requested_at <= ?))`;

/**
 * Runs the whole schedule. `dryRun` (default true) only counts. Each rule is independent: one failing rule is reported and the others still run.
 * Returns { dryRun, counts: { table or rule: n }, errors: { rule: message } }.
 */
export async function runRetention(env, { now = new Date(), dryRun = true } = {}) {
  const counts = {}; const errors = {};
  if (!env?.DB) return { dryRun, counts, errors: { db: 'no database' } };
  await ensureRetentionSchema(env);
  const rule = async (name, fn) => { try { counts[name] = await fn(); } catch (e) { errors[name] = String(e?.message || e).slice(0, 160); } };

  // 1. events older than 13 months -> monthly aggregate, then deleted (one batch, so a failure leaves both untouched)
  const eventCutoff = sqlTs(monthsAgo(now, RETENTION.eventMonths));
  await rule('events_rolled_up', async () => {
    const n = await count(env, 'SELECT COUNT(*) AS n FROM events WHERE ts < ?', [eventCutoff]);
    if (dryRun || n === 0) return n;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO events_monthly_agg (month, event_type, ua_class, n)
        SELECT substr(ts, 1, 7), event_type, COALESCE(ua_class, ''), COUNT(*) FROM events WHERE ts < ? GROUP BY 1, 2, 3
        ON CONFLICT (month, event_type, ua_class) DO UPDATE SET n = n + excluded.n`).bind(eventCutoff),
      env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(eventCutoff),
    ]);
    return n;
  });

  // 2. delivery logs 90 days after the send
  const deliveryCutoff = daysAgo(now, RETENTION.deliveryDays);
  for (const [table, column] of DELIVERY_LOGS) {
    await rule(`delivery_log:${table}`, async () => {
      if (!(await tableExists(env, table))) return 0;
      const cutoff = column === 'delivered_on' || column === 'sent_on' ? deliveryCutoff.toISOString().slice(0, 10) : sqlTs(deliveryCutoff);
      const n = await count(env, `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} < ?`, [cutoff]);
      if (!dryRun && n) await env.DB.prepare(`DELETE FROM ${table} WHERE ${column} < ?`).bind(cutoff).run();
      return n;
    });
  }

  // 3. personal data 30 days after unsubscribe / sunset / deletion request
  const personalCutoff = sqlTs(daysAgo(now, RETENTION.personalDays));
  const dueBinds = [personalCutoff, personalCutoff, personalCutoff];
  await rule('sunset_marked', async () => {
    // The sunset pause records no time of its own, so the first run that sees a paused subscriber stamps it; the 30 days run from then.
    const toMark = await count(env, 'SELECT COUNT(*) AS n FROM users WHERE is_subscribed = 0 AND sunset_at IS NULL AND unsubscribed_at IS NULL AND anonymized_at IS NULL');
    if (!dryRun) {
      await env.DB.prepare("UPDATE users SET sunset_at = ? WHERE is_subscribed = 0 AND sunset_at IS NULL AND unsubscribed_at IS NULL AND anonymized_at IS NULL").bind(sqlTs(now)).run();
      await env.DB.prepare('UPDATE users SET sunset_at = NULL WHERE is_subscribed = 1 AND sunset_at IS NOT NULL').run(); // reactivated: the clock stops
    }
    return toMark;
  });
  await rule('users_anonymized', async () => {
    const due = (await env.DB.prepare(`SELECT id, email FROM users WHERE ${DUE_USERS} LIMIT ?`).bind(...dueBinds, RETENTION.maxUsersPerRun).all())?.results || [];
    if (dryRun) {
      // The dry run also reports what would go with them, per table.
      const total = await count(env, `SELECT COUNT(*) AS n FROM users WHERE ${DUE_USERS}`, dueBinds);
      for (const [table, col, sel] of [['watchlists', 'user_id', 'id'], ['pto_window_watches', 'user_id', 'id'], ['push_subscriptions', 'user_id', 'id'], ['referral_codes', 'user_id', 'id'],
        ['away_plans', 'email', 'email'], ['plus_waitlist', 'email', 'email']]) {
        if (await tableExists(env, table)) counts[`person_data:${table}`] = await count(env, `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} IN (SELECT ${sel} FROM users WHERE ${DUE_USERS})`, dueBinds);
      }
      return total;
    }
    let done = 0;
    for (const u of due) {
      const statements = [];
      const del = (table, col, val) => statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(val));
      for (const [table, col, val] of [['watchlists', 'user_id', u.id], ['pto_window_watches', 'user_id', u.id], ['push_subscriptions', 'user_id', u.id], ['referral_codes', 'user_id', u.id],
        ['plus_waitlist', 'email', u.email]]) if (await tableExists(env, table)) del(table, col, val);
      if (await tableExists(env, 'away_plans')) {
        statements.push(env.DB.prepare('DELETE FROM away_plan_reminders WHERE plan_id IN (SELECT id FROM away_plans WHERE email = ?)').bind(u.email));
        statements.push(env.DB.prepare('DELETE FROM away_plan_done WHERE plan_id IN (SELECT id FROM away_plans WHERE email = ?)').bind(u.email));
        statements.push(env.DB.prepare('DELETE FROM home_cards WHERE plan_id IN (SELECT id FROM away_plans WHERE email = ?)').bind(u.email));
        del('away_plans', 'email', u.email);
      }
      for (const table of EMAIL_KEYED) if (await tableExists(env, table)) del(table, 'email', u.email);
      // Anonymise the row last. email_suppressions and consent_log are deliberately left alone.
      statements.push(env.DB.prepare(`UPDATE users SET email = 'deleted-' || id || '@deleted.invalid', origin_iata = NULL, pet_owner = NULL, has_pet = NULL, away_needs = NULL,
        leave_answers = NULL, trip_length = NULL, passenger_count = NULL, referred_by = NULL, verification_token = NULL, verified_email = 0, notify_email = 0, notify_push = 0,
        is_subscribed = 0, anonymized_at = ? WHERE id = ? AND anonymized_at IS NULL`).bind(sqlTs(now), u.id));
      await env.DB.batch(statements);
      done += 1;
    }
    return done;
  });

  return { dryRun, counts, errors };
}

/** Runs the schedule and records the result as a retention_run event (counts only) for the Monday brief. */
export async function runRetentionAndRecord(env, opts = {}) {
  const dryRun = opts.dryRun ?? retentionIsDryRun(env);
  // Real deletion is refused unless both flags say so, whatever the caller asked for.
  const effectiveDry = dryRun || !retentionEnabled(env) || retentionIsDryRun(env);
  const result = await runRetention(env, { ...opts, dryRun: effectiveDry });
  await logEvent(env, { event_type: 'retention_run', source: 'retention', meta: { dry_run: result.dryRun, counts: result.counts, errors: result.errors } });
  return result;
}
