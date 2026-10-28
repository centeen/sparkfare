// N8 (Addendum N, ROADMAP step 155; framework DR-24): one same-day email when something about the data is wrong, and no email when it is not.
//
// A Cron Trigger at 09:30 UTC (DATA_ALERT_CRON in index.js), after the 08:00 digest, evaluates the checks below. Any breach goes into ONE
// email to the owner (OPS_ALERT_EMAIL or hello@sparkfare.com): subject "Sparkfare data alert: <check>", and for every breach its value,
// its limit and the section of docs/data/RUNBOOK.md to open. At most one such email a day (data_alert_log), however many breaches
// there are and however many days in a row the same one persists. Nothing is breached, nothing is sent.
//
// Limits are the owner's decision of 2026-10-24: the multi-origin feed alerts at 10 hours and is critical at 14 (observed gaps between
// hourly runs reach about 6 hours; a run can take 47 minutes). The daily files are judged at 30 hours (framework 5.5).
//
// NOT checked here, because a Worker cannot read it: D1 rows read and written per day, and Workers requests per day. Those are in the
// Cloudflare dashboard (see the runbook's "D1 or Workers usage" section).
import { checkBackupState } from './backupHealth.js';
import { readSendingGuardStatus } from './email.js';
import { servedJson } from './r2Serving.js';

export const DATA_ALERT_CRON = '30 9 * * *';
const PIPELINES = [{ pipeline: 'daily_jfk', label: 'JFK daily fetch' }, { pipeline: 'multi_origin', label: 'hourly multi-origin fetch' }];
export const dataAlertsEnabled = (env) => env?.ENABLE_DATA_ALERTS === 'true';

const H = 36e5;
export const SERVED_FILES = [
  { file: 'sparkfare_ranked_deals.json', label: 'JFK daily deals', warnHours: 30, criticalHours: 48 },
  { file: 'sparkfare_ranked_deals_other_origins.json', label: 'other-origins daily deals', warnHours: 30, criticalHours: 48 },
  { file: 'sparkfare_hourly_ranked_deals.json', label: 'hourly multi-origin deals', warnHours: 10, criticalHours: 14 },
];
// Hours since the newest validation result was recorded, per pipeline (warn / critical).
export const RUN_AGE_LIMITS = {
  daily_jfk: { warnHours: 36, criticalHours: 48 },
  multi_origin: { warnHours: 10, criticalHours: 14 },
};
export const D1_SIZE = { defaultLimitBytes: 10 * 1024 ** 3, warnShare: 0.7, criticalShare: 0.9 }; // 10 GB on Workers Paid (500 MB on Free)

const breach = (id, level, title, value, threshold, runbook) => ({ id, level, title, value, threshold, runbook });
const levelFor = (hours, warn, critical) => (hours > critical ? 'critical' : hours > warn ? 'warn' : null);
const fmtH = (h) => `${Math.round(h * 10) / 10} h`;

async function loadServed(env, file) {
  return servedJson(env, file); // N14: what is actually served (R2 when that is on, otherwise the deployed asset)
}

/** Served ranked-deals files: readable, fresh, with priced routes and clean keys. */
export async function checkServedFiles(env, now) {
  if (!env?.ASSETS) return [];
  const out = [];
  for (const { file, label, warnHours, criticalHours } of SERVED_FILES) {
    let data = null;
    try { data = await loadServed(env, file); } catch (error) {
      out.push(breach('served_files', 'critical', `${label} cannot be read`, String(error.message ?? error), 'readable JSON', 'Served data is stale or missing'));
      continue;
    }
    const generated = data?.generated_at ? new Date(data.generated_at) : null;
    if (!generated || Number.isNaN(generated.getTime())) {
      out.push(breach('served_files', 'critical', `${label} has no generated_at`, 'missing', 'an ISO timestamp', 'Served data is stale or missing'));
      continue;
    }
    const age = (now - generated) / H;
    const level = levelFor(age, warnHours, criticalHours);
    if (level) out.push(breach('served_files', level, `${label} is stale`, `${fmtH(age)} old`, `${warnHours} h (critical ${criticalHours} h)`, 'Served data is stale or missing'));
    const records = ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data'].flatMap((b) => (Array.isArray(data[b]) ? data[b] : []));
    const priced = ['deals', 'featured', 'priced_no_deal'].reduce((n, b) => n + (Array.isArray(data[b]) ? data[b].length : 0), 0);
    if (priced === 0) out.push(breach('served_files', 'critical', `${label} has no priced routes`, '0 priced', 'at least 1', 'Served data is stale or missing'));
    const doubled = records.filter((r) => typeof r?.route_key === 'string' && /^[A-Z]{3}:[A-Z]{3}:/.test(r.route_key)).length;
    if (doubled) out.push(breach('served_files', 'critical', `${label} has doubled origin prefixes`, `${doubled} key(s)`, '0', 'Served data is stale or missing'));
  }
  return out;
}

/** The validation gate's last verdict per pipeline (written by scripts/data/publish-result.mjs into the private raw bucket). */
export async function checkPipelineRuns(env, now) {
  if (!env?.RAW) return [];
  const out = [];
  for (const { pipeline, label } of PIPELINES) {
    let latest = null;
    try {
      const obj = await env.RAW.get(`state/${pipeline}/latest.json`);
      latest = obj ? JSON.parse(await obj.text()) : null;
    } catch (error) {
      out.push(breach('pipeline_runs', 'warn', `${label}: the last result cannot be read`, String(error?.message ?? error).slice(0, 120), 'readable', 'A fetch run was blocked or has stopped'));
      continue;
    }
    if (!latest) continue; // nothing recorded yet
    if (latest.status === 'blocked') {
      out.push(breach('pipeline_runs', 'critical', `${label}: the validation gate blocked a run`, `${latest.run_id} (${(latest.failed_checks || []).join(', ') || 'no check named'})`, 'status ok', 'A fetch run was blocked or has stopped'));
    }
    const limits = RUN_AGE_LIMITS[pipeline] || { warnHours: 36, criticalHours: 48 };
    const published = new Date(latest.published_at);
    const age = Number.isNaN(published.getTime()) ? null : (now - published) / H;
    const level = age === null ? 'warn' : levelFor(age, limits.warnHours, limits.criticalHours);
    if (level) out.push(breach('pipeline_runs', level, `${label}: no finished run recorded`, age === null ? 'undated' : `${fmtH(age)} since the last result`, `${limits.warnHours} h (critical ${limits.criticalHours} h)`, 'A fetch run was blocked or has stopped'));
  }
  return out;
}

/** The nightly D1 backup and the monthly restore drill (src/backupHealth.js decides; each of its problems is one breach). */
export async function checkBackups(env, now) {
  if (!env?.RAW) return [];
  const { problems } = await checkBackupState(env, now);
  return problems.map((p) => breach('d1_backup', /FAILED|hours old|undated/i.test(p) ? 'critical' : 'warn', p, 'see the message', 'backup 26 h; last drill passed', 'The D1 backup is old or the restore drill failed'));
}

/** Database size against the plan's limit. Reads the size D1 reports with any query. */
export async function checkD1Size(env) {
  if (!env?.DB) return [];
  let size = null;
  try {
    const res = await env.DB.prepare('SELECT 1').run();
    size = Number(res?.meta?.size_after);
  } catch { return []; }
  if (!Number.isFinite(size) || size <= 0) return [];
  const limit = Number(env.D1_SIZE_LIMIT_BYTES) || D1_SIZE.defaultLimitBytes;
  const share = size / limit;
  const level = share > D1_SIZE.criticalShare ? 'critical' : share > D1_SIZE.warnShare ? 'warn' : null;
  const mb = (b) => `${Math.round(b / 1048576)} MB`;
  return level ? [breach('d1_size', level, 'The database is close to its size limit', `${mb(size)} (${Math.round(share * 100)}%)`, `${Math.round(D1_SIZE.warnShare * 100)}% of ${mb(limit)} (critical ${Math.round(D1_SIZE.criticalShare * 100)}%)`, 'D1 or Workers usage')] : [];
}

/** Did this morning's digest go out? Failed rows, or nobody emailed although verified subscribers exist. */
// The 07:00 and 08:00 UTC sends have not happened before DIGEST_RAN_BY_UTC_MINUTES, so "no rows yet" is only a breach after it (a manual run at
// 04:00 UTC must not report a digest that was never due). Failed rows are reported at any time.
const DIGEST_RAN_BY_UTC_MINUTES = 8 * 60 + 30;
export async function checkDigestDelivery(env, now) {
  if (!env?.DB || env.ENABLE_DAILY_DIGEST === 'false') return [];
  const today = now.toISOString().slice(0, 10);
  try {
    const rows = (await env.DB.prepare('SELECT status, COUNT(*) AS n FROM daily_alert_deliveries WHERE delivered_on = ? GROUP BY status').bind(today).all()).results || [];
    const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    const subs = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1').first();
    const out = [];
    if ((by.failed || 0) > 0) out.push(breach('digest_delivery', 'critical', "Some of this morning's digests failed", `${by.failed} failed of ${rows.reduce((n, r) => n + r.n, 0)}`, '0 failed', "This morning's digest did not go out"));
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    // Q7: with the local-morning send on, the digests go out between 10:30 and 15:30 UTC (06:30 in each home-airport zone), after this 09:30 UTC check, so
    // "nobody emailed yet" is judged on yesterday's UTC day instead (the TLV morning, 03:30 to 04:30 UTC, belongs to the same UTC day as the US mornings).
    if (env.ENABLE_LOCAL_MORNING_SEND === 'true') {
      const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      const prev = await env.DB.prepare('SELECT COUNT(*) AS n FROM daily_alert_deliveries WHERE delivered_on = ?').bind(yesterday).first();
      if ((subs?.n || 0) > 0 && (prev?.n || 0) === 0) out.push(breach('digest_delivery', 'critical', "Yesterday's digest did not run", `0 delivery rows on ${yesterday} for ${subs.n} subscriber(s)`, 'one row per subscriber', "Yesterday's digest did not go out"));
      return out;
    }
    if ((subs?.n || 0) > 0 && rows.length === 0 && minutes >= DIGEST_RAN_BY_UTC_MINUTES) out.push(breach('digest_delivery', 'critical', "This morning's digest did not run", `0 delivery rows for ${subs.n} subscriber(s)`, 'one row per subscriber', "This morning's digest did not go out"));
    return out;
  } catch { return []; } // a missing table is not an alert
}

/** The bounce/complaint circuit breaker: when it is tripped, every guarded email is being skipped. */
export async function checkEmailGuard(env) {
  if (!env?.DB) return [];
  try {
    const g = await readSendingGuardStatus(env);
    if (g?.tripped) return [breach('email_guard', 'critical', 'The email sending guard is tripped', g.reason, 'not tripped', 'The email sending guard is tripped')];
  } catch { /* the guard check fails open elsewhere; not an alert by itself */ }
  return [];
}

/**
 * Q4 (D-049): non-transactional email is being skipped because EMAIL_POSTAL_ADDRESS is not set. Counts the `email_blocked_no_postal_address` events of the
 * last 24 hours. The N8 alert is already at most one email a day, so this is the "one owner alert a day" the rule asks for.
 */
export async function checkBlockedMail(env) {
  if (!env?.DB) return [];
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'email_blocked_no_postal_address' AND ts > datetime('now', '-1 day')").first();
    if ((row?.n || 0) > 0) return [breach('email_blocked_no_postal_address', 'critical', 'Email is being blocked: no postal address is set', `${row.n} send${row.n === 1 ? '' : 's'} skipped in 24 h`, '0 skipped', 'Email is blocked: no postal address')];
  } catch { /* a missing events table is not an alert */ }
  return [];
}

/**
 * Q4.4 (D-049): below the breaker's 200-send floor a complaint suppresses that address (the Resend webhook does it) and blocks nothing else, so the owner
 * has to hear about it here. Counts `email_complaint` events of the last 7 days.
 */
export async function checkComplaints(env) {
  if (!env?.DB) return [];
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'email_complaint' AND ts > datetime('now', '-7 days')").first();
    if ((row?.n || 0) > 0) return [breach('email_complaint', 'warn', 'A recipient marked an email as spam', `${row.n} in 7 days`, '0', 'A recipient complained')];
  } catch { /* a missing events table is not an alert */ }
  return [];
}

export async function evaluateDataAlerts(env, now = new Date()) {
  const checks = [checkServedFiles, checkPipelineRuns, checkBackups, checkD1Size, checkDigestDelivery, checkEmailGuard, checkBlockedMail, checkComplaints];
  const breaches = [];
  for (const check of checks) {
    try { breaches.push(...await check(env, now)); } catch (error) { console.error(`data alert check ${check.name} failed:`, error); }
  }
  breaches.sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1));
  return breaches;
}

export function alertSubject(breaches) {
  const first = breaches[0];
  return `Sparkfare data alert: ${first.title}${breaches.length > 1 ? ` (+${breaches.length - 1} more)` : ''}`;
}

/** Evaluate, then send at most one email today. `send` is injected for tests; dry run sends and records nothing. */
export async function runDataAlerts(env, { now = new Date(), send, dryRun = false } = {}) {
  if (!dataAlertsEnabled(env)) return { enabled: false, breaches: [], sent: false };
  const breaches = await evaluateDataAlerts(env, now);
  if (!breaches.length) return { enabled: true, breaches, sent: false };
  if (dryRun) return { enabled: true, breaches, sent: false, dryRun: true };
  const today = now.toISOString().slice(0, 10);
  if (env.DB) {
    try {
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS data_alert_log (date TEXT PRIMARY KEY, breaches INTEGER NOT NULL, sent_at TEXT DEFAULT (datetime(\'now\')))').run();
      const done = await env.DB.prepare('SELECT 1 AS x FROM data_alert_log WHERE date = ?').bind(today).first();
      if (done) return { enabled: true, breaches, sent: false, reason: 'already emailed today' };
    } catch (error) { console.error('data alert log check failed:', error); }
  }
  const result = await send(env, breaches);
  if (result?.ok && !result.mocked && env.DB) {
    try { await env.DB.prepare('INSERT OR IGNORE INTO data_alert_log (date, breaches) VALUES (?, ?)').bind(today, breaches.length).run(); }
    catch (error) { console.error('data alert log write failed:', error); }
  }
  return { enabled: true, breaches, sent: !!result?.ok, result };
}
