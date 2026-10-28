// Addendum Q, Q1 (D-049, G110): the one-envelope send budget. A recipient's local day has a fixed number of non-transactional emails, in a fixed order of
// importance, and every non-transactional sender asks here before it sends.
//
//   - Transactional mail (verification, confirmations, the support reply) is never counted or blocked.
//   - At most ONE email carrying fares per recipient per local day (streams `alert` and `digest`).
//   - At most ONE lifecycle email (the ranked kinds below) per recipient per local day. When several are due, the higher one is sent and the rest are
//     deferred; each caller's own timeliness window (departure passed, a few days after a click) is what finally drops a deferred email.
//   - At most TWO non-transactional emails per recipient per local day in total (the ceiling).
//   - The local day is the recipient's origin zone (ORIGIN_TIME_ZONES); UTC when the origin is unknown.
//
// One ledger row per (email, local day, kind). The row is written BEFORE the send (so two runs cannot both pass) and removed again if the send fails, so a
// failed send does not use up the day. Counts only: the table holds an address because the rule is per recipient, and follows D-042 (delivery logs: 90 days).
import { ORIGIN_TIME_ZONES } from './originZones.js';
import { sendWindowReason } from './localMorning.js';

/** Lifecycle kinds, highest priority first (Addendum Q1). Other trip-stream kinds ('checklist', 'youre_set') answer the reader's own action or are
 *  date-specific; they count toward the ceiling but are not limited to one a day. */
export const LIFECYCLE_RANK = ['plan_reminder', 'departing_soon', 'prep_1', 'briefing', 'prep_7', 'prep_14', 'stress_valve', 'retrospective', 'purchase_reported'];
export const FARE_STREAMS = ['alert', 'digest'];
export const DAILY_CEILING = 2;
export const LEDGER_RETENTION_DAYS = 90;

/** Emails that answer the reader's own action or are date-specific. They may repeat on one day (two trips clicked), so each gets its own ledger row, and they count toward the ceiling. */
export const REPEATABLE_KINDS = ['checklist', 'youre_set'];
export const isRepeatableKind = (kind) => REPEATABLE_KINDS.includes(kind);
export const isLifecycleKind = (kind) => LIFECYCLE_RANK.includes(kind);
export const isFareStream = (stream) => FARE_STREAMS.includes(stream);

const LEDGER_READY = new WeakSet();
export async function ensureLedger(env) {
  if (!env?.DB || LEDGER_READY.has(env.DB)) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_send_ledger (
    email TEXT NOT NULL,
    local_date TEXT NOT NULL,
    kind TEXT NOT NULL,
    stream TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'claimed',
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (email, local_date, kind)
  )`).run();
  LEDGER_READY.add(env.DB);
}

/** The recipient's calendar date (YYYY-MM-DD) in their origin's zone. UTC for an unknown origin. */
export function localDateFor(origin, now = new Date()) {
  const zone = ORIGIN_TIME_ZONES[String(origin || '').toUpperCase()] || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Pure rule. `rows` are the recipient's ledger rows for that local day: [{ kind, stream }]. Returns null to allow, or the reason to defer. */
export function deferReason(rows, { stream, kind }) {
  if (!isRepeatableKind(kind) && rows.some((r) => r.kind === kind)) return 'already_sent_today';
  if (isFareStream(stream) && rows.some((r) => isFareStream(r.stream))) return 'one_fare_email_a_day';
  if (isLifecycleKind(kind) && rows.some((r) => isLifecycleKind(r.kind))) return 'one_lifecycle_email_a_day';
  if (rows.length >= DAILY_CEILING) return 'daily_ceiling';
  return null;
}

async function originOf(env, email) {
  try {
    const row = await env.DB.prepare('SELECT origin_iata FROM users WHERE email = ?').bind(email).first();
    return row?.origin_iata || null;
  } catch { return null; }
}

async function logSlotEvent(env, meta) {
  try {
    await env.DB.prepare("INSERT INTO events (id, event_type, source, meta) VALUES (lower(hex(randomblob(16))), 'email_slot', 'email', ?)").bind(JSON.stringify(meta)).run();
  } catch (error) { console.error('email_slot event failed:', error?.message || error); }
}

/**
 * Ask for today's slot. Returns { allow: true, localDate } (the row is claimed) or { allow: false, reason, localDate }.
 * Never throws: if the ledger cannot be read the send is allowed (a broken budget must not silence every email) and the failure is logged.
 */
export async function claimSendSlot(env, { email, stream, kind, origin = null, now = new Date() }) {
  if (!env?.DB || !email || !kind || stream === 'transactional') return { allow: true, localDate: null, untracked: true };
  try {
    await ensureLedger(env);
    const home = origin || (await originOf(env, email));
    const localDate = localDateFor(home, now);
    // Q7: with ENABLE_LOCAL_MORNING_SEND on, a scheduled email only goes in the reader's local morning (and never in quiet hours).
    const windowReason = sendWindowReason(env, { kind, origin: home, now });
    if (windowReason) {
      await logSlotEvent(env, { decision: 'defer', stream, kind, reason: windowReason });
      return { allow: false, reason: windowReason, localDate };
    }
    const existing = await env.DB.prepare('SELECT kind, stream FROM email_send_ledger WHERE email = ? AND local_date = ?').bind(email, localDate).all();
    const reason = deferReason(existing?.results || [], { stream, kind });
    if (reason) {
      await logSlotEvent(env, { decision: 'defer', stream, kind, reason });
      return { allow: false, reason, localDate };
    }
    const rows = existing?.results || [];
    const ledgerKind = isRepeatableKind(kind) ? `${kind}#${rows.filter((r) => String(r.kind).startsWith(`${kind}#`)).length + 1}` : kind;
    const res = await env.DB.prepare("INSERT OR IGNORE INTO email_send_ledger (email, local_date, kind, stream, status) VALUES (?, ?, ?, ?, 'claimed')")
      .bind(email, localDate, ledgerKind, stream).run();
    if (res?.meta?.changes === 0) {
      await logSlotEvent(env, { decision: 'defer', stream, kind, reason: 'already_sent_today' });
      return { allow: false, reason: 'already_sent_today', localDate };
    }
    await logSlotEvent(env, { decision: 'allow', stream, kind });
    return { allow: true, localDate, ledgerKind };
  } catch (error) {
    console.error('claimSendSlot failed; allowing the send:', error?.message || error);
    return { allow: true, localDate: null, untracked: true };
  }
}

/** Give a claimed slot back (the send failed). */
export async function releaseSendSlot(env, { email, kind, localDate }) {
  if (!env?.DB || !localDate) return;
  try { await env.DB.prepare('DELETE FROM email_send_ledger WHERE email = ? AND local_date = ? AND kind = ?').bind(email, localDate, kind).run(); }
  catch (error) { console.error('releaseSendSlot failed:', error?.message || error); }
}

/** Mark a claimed slot as sent. */
export async function confirmSendSlot(env, { email, kind, localDate }) {
  if (!env?.DB || !localDate) return;
  try { await env.DB.prepare("UPDATE email_send_ledger SET status = 'sent' WHERE email = ? AND local_date = ? AND kind = ?").bind(email, localDate, kind).run(); }
  catch (error) { console.error('confirmSendSlot failed:', error?.message || error); }
}

/**
 * The digest and the weekly edition, in bulk (N4: no per-recipient query fan-out). recipients: [{ email, origin }].
 * One read for everyone, one bulk insert for those allowed. Returns { allowed: Set(email), denied: Map(email -> reason), dates: Map(email -> localDate) }.
 * Fails open: on any error everyone is allowed and nothing is claimed.
 */
export async function claimBulkFareSlots(env, recipients, { stream = 'digest', kind = 'digest', now = new Date() } = {}) {
  const allowed = new Set(); const denied = new Map(); const dates = new Map();
  if (!env?.DB || !recipients.length) { for (const r of recipients) allowed.add(r.email); return { allowed, denied, dates }; }
  try {
    await ensureLedger(env);
    const dateOf = new Map(recipients.map((r) => [r.email, localDateFor(r.origin, now)]));
    const emails = [...dateOf.keys()];
    const have = new Map();
    for (let i = 0; i < emails.length; i += 500) {
      const part = emails.slice(i, i + 500);
      const rows = await env.DB.prepare('SELECT email, local_date, kind, stream FROM email_send_ledger WHERE email IN (SELECT value FROM json_each(?)) AND local_date >= ?')
        .bind(JSON.stringify(part), new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10)).all();
      for (const row of rows?.results || []) {
        const key = `${row.email}|${row.local_date}`;
        if (!have.has(key)) have.set(key, []);
        have.get(key).push({ kind: row.kind, stream: row.stream });
      }
    }
    const toInsert = [];
    for (const r of recipients) {
      const localDate = dateOf.get(r.email);
      dates.set(r.email, localDate);
      const reason = sendWindowReason(env, { kind, origin: r.origin, now }) || deferReason(have.get(`${r.email}|${localDate}`) || [], { stream, kind });
      if (reason) denied.set(r.email, reason);
      else { allowed.add(r.email); toInsert.push({ e: r.email, d: localDate }); }
    }
    for (let i = 0; i < toInsert.length; i += 500) {
      await env.DB.prepare("INSERT OR IGNORE INTO email_send_ledger (email, local_date, kind, stream, status) SELECT json_extract(value, '$.e'), json_extract(value, '$.d'), ?, ?, 'claimed' FROM json_each(?)")
        .bind(kind, stream, JSON.stringify(toInsert.slice(i, i + 500))).run();
    }
    const counts = {};
    for (const reason of denied.values()) counts[reason] = (counts[reason] || 0) + 1;
    await logSlotEvent(env, { decision: 'batch', stream, kind, allowed: allowed.size, deferred: denied.size, reasons: counts });
  } catch (error) {
    console.error('claimBulkFareSlots failed; allowing every send:', error?.message || error);
    allowed.clear(); denied.clear(); dates.clear();
    for (const r of recipients) allowed.add(r.email);
  }
  return { allowed, denied, dates };
}

/** Give back many claimed slots (their sends failed). entries: [{ email, localDate }]. */
export async function releaseBulkSlots(env, entries, { kind = 'digest' } = {}) {
  if (!env?.DB || !entries.length) return;
  try {
    for (let i = 0; i < entries.length; i += 500) {
      await env.DB.prepare("DELETE FROM email_send_ledger WHERE kind = ? AND (email || '|' || local_date) IN (SELECT json_extract(value, '$.e') || '|' || json_extract(value, '$.d') FROM json_each(?))")
        .bind(kind, JSON.stringify(entries.slice(i, i + 500).map((e) => ({ e: e.email, d: e.localDate })))).run();
    }
  } catch (error) { console.error('releaseBulkSlots failed:', error?.message || error); }
}

/** D-042: delivery logs are kept 90 days after the last send. */
export async function purgeSendLedger(env, now = new Date()) {
  if (!env?.DB) return { purged: 0 };
  try {
    await ensureLedger(env);
    const cutoff = new Date(now.getTime() - LEDGER_RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
    const res = await env.DB.prepare('DELETE FROM email_send_ledger WHERE local_date < ?').bind(cutoff).run();
    return { purged: Number(res?.meta?.changes || 0) };
  } catch (error) { console.error('purgeSendLedger failed:', error?.message || error); return { purged: 0 }; }
}
