// Addendum Q, Q8 (D-049, G117/Framework guardrails): every send carries a Resend tag `stream` (transactional, alert, trip, digest, care) and `kind` (the email's name).
// Resend returns the tags on every webhook event, so delivered / clicked / bounced / complained events can be counted per stream with no per-send log. The numbers feed
// the owner view (/admin/growth) and the Monday standup, and the guardrails below pause a stream that is hurting the sender's reputation.
import { STREAMS } from './emailCompliance.js';

// Guardrails (the Framework): evaluated over 7 days, and only with at least MIN_DELIVERED delivered in the window; below that the numbers are reported, never acted on.
export const STREAM_GUARDRAILS = { windowDays: 7, minDelivered: 1000, complaintRate: 0.001, hardBounceRate: 0.02, dailyUnsubscribeRate: 0.005 };

/** Resend tag values may hold only ASCII letters, numbers, underscores and dashes. */
const clean = (value) => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) || 'unknown';

export function tagsFor(stream, kind) {
  const tags = [{ name: 'stream', value: clean(stream) }];
  if (kind) tags.push({ name: 'kind', value: clean(kind) });
  return tags;
}

/** { stream, kind } from the `tags` of a Resend webhook event (an object, or an array of { name, value }). Null parts when absent. */
export function streamOfTags(tags) {
  let stream = null; let kind = null;
  if (Array.isArray(tags)) {
    for (const t of tags) { if (t?.name === 'stream') stream = t.value; if (t?.name === 'kind') kind = t.value; }
  } else if (tags && typeof tags === 'object') {
    stream = tags.stream ?? null; kind = tags.kind ?? null;
  }
  return { stream: STREAMS.includes(stream) ? stream : null, kind: kind ? String(kind) : null };
}

/** Which stream a partner click came from, by the `src` the email link carries. Surfaces that are not an email map to null. */
export function srcToStream(src) {
  const s = String(src || '');
  if (/^(digest|digest_block|digest_weekly|weekly|pto_email|newsletter|watch)/.test(s)) return 'digest';
  if (s.startsWith('email_')) return 'trip'; // the post-click emails (follow-up, briefing, departing, sequence, stress valve)
  return null;
}

// ---------- pausing ----------

const pausedCache = new Map(); // stream -> { paused, at }
export function _resetStreamPausesForTests() { pausedCache.clear(); }

async function ensurePauseTable(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS stream_pauses (stream TEXT PRIMARY KEY, reason TEXT NOT NULL, paused_at TEXT DEFAULT (datetime('now')))").run();
}

/** True when the owner-facing guardrails paused this stream. Transactional is never paused. Cached for 5 minutes; fails open (a broken check must not silence mail). */
export async function isStreamPaused(env, stream) {
  if (!env?.DB || !stream || stream === 'transactional') return false;
  const hit = pausedCache.get(stream);
  if (hit && Date.now() - hit.at < 300000) return hit.paused;
  try {
    await ensurePauseTable(env);
    const row = await env.DB.prepare('SELECT 1 AS p FROM stream_pauses WHERE stream = ?').bind(stream).first();
    pausedCache.set(stream, { paused: Boolean(row), at: Date.now() });
    return Boolean(row);
  } catch (error) {
    console.error('isStreamPaused failed; allowing the send:', error?.message || error);
    return false;
  }
}

/** The owner un-pauses a stream after looking into it. */
export async function resumeStream(env, stream) {
  if (!env?.DB) return;
  await ensurePauseTable(env);
  await env.DB.prepare('DELETE FROM stream_pauses WHERE stream = ?').bind(stream).run();
  pausedCache.delete(stream);
}

// ---------- the numbers ----------

const rate = (n, d) => (d > 0 ? n / d : null);

/** Per-stream table for a window: counts always, rates only at or above the sample floor. `rows` come from the stream_* metrics (src/metrics/definitions.js). */
export function buildStreamTable({ delivered = [], clickers = [], unsubscribes = [], complaints = [], hardBounces = [], partnerClicks = [] }) {
  const by = (rows, key = 'n') => Object.fromEntries(rows.map((r) => [r.stream, Number(r[key]) || 0]));
  const d = by(delivered); const c = by(clickers); const u = by(unsubscribes); const k = by(complaints); const b = by(hardBounces); const p = by(partnerClicks);
  return STREAMS.map((stream) => {
    const del = d[stream] || 0;
    const enough = del >= STREAM_GUARDRAILS.minDelivered;
    return {
      stream, delivered: del, unique_clickers: c[stream] || 0, unsubscribes: u[stream] || 0, complaints: k[stream] || 0, hard_bounces: b[stream] || 0, partner_clicks: p[stream] || 0,
      // Counts only below 1,000 delivered; rates above.
      rates: enough ? {
        clickers_per_100: Math.round(rate(c[stream] || 0, del) * 1000) / 10,
        unsubscribes_per_send_pct: Math.round(rate(u[stream] || 0, del) * 10000) / 100,
        complaint_pct: Math.round(rate(k[stream] || 0, del) * 10000) / 100,
        hard_bounce_pct: Math.round(rate(b[stream] || 0, del) * 10000) / 100,
      } : null,
    };
  });
}

export async function computeStreamTable(env, window) {
  const { runMetric } = await import('./metrics/definitions.js');
  const get = (id) => runMetric(env, id, window).catch(() => []);
  const [delivered, clickers, unsubscribes, complaints, hardBounces, partnerClicks] = await Promise.all(
    ['stream_delivered', 'stream_clickers', 'stream_unsubscribes', 'stream_complaints', 'stream_hard_bounces', 'stream_partner_clicks'].map(get));
  return buildStreamTable({ delivered, clickers, unsubscribes, complaints, hardBounces, partnerClicks });
}

/** Pure: which streams breach a guardrail, given the 7-day table and each stream's worst single-day unsubscribe rate. */
export function breachesOf(table, dailyUnsubs = {}) {
  const g = STREAM_GUARDRAILS;
  const out = [];
  for (const row of table) {
    if (row.stream === 'transactional' || row.delivered < g.minDelivered) continue;
    if (row.complaints / row.delivered > g.complaintRate) out.push({ stream: row.stream, reason: `complaints ${(row.complaints / row.delivered * 100).toFixed(2)}% of ${row.delivered} delivered over 7 days (limit ${g.complaintRate * 100}%)` });
    else if (row.hard_bounces / row.delivered > g.hardBounceRate) out.push({ stream: row.stream, reason: `hard bounces ${(row.hard_bounces / row.delivered * 100).toFixed(2)}% of ${row.delivered} delivered over 7 days (limit ${g.hardBounceRate * 100}%)` });
    else if (dailyUnsubs[row.stream] && dailyUnsubs[row.stream].rate > g.dailyUnsubscribeRate) out.push({ stream: row.stream, reason: `unsubscribes ${(dailyUnsubs[row.stream].rate * 100).toFixed(2)}% of ${dailyUnsubs[row.stream].delivered} delivered on ${dailyUnsubs[row.stream].day} (limit ${g.dailyUnsubscribeRate * 100}%)` });
  }
  return out;
}

/**
 * Daily check: pause every stream that breaches a guardrail and tell the owner. `notify(breaches)` is injected (the owner email). A stream already paused is not
 * reported again. Below 1,000 delivered nothing is paused: the table is for reading, not acting.
 */
export async function checkStreamGuardrails(env, { now = new Date(), notify = null } = {}) {
  if (!env?.DB) return { paused: [] };
  const to = new Date(now.getTime());
  const from = new Date(now.getTime() - STREAM_GUARDRAILS.windowDays * 86400000);
  const table = await computeStreamTable(env, { from, to });
  // The unsubscribe guardrail looks at the most recent complete day per stream (a "send" is a stream's day: the digest is one send a day).
  const dayFrom = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - 1));
  const dayTo = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const day = await computeStreamTable(env, { from: dayFrom, to: dayTo });
  const dailyUnsubs = {};
  for (const r of day) if (r.delivered >= STREAM_GUARDRAILS.minDelivered) dailyUnsubs[r.stream] = { rate: r.unsubscribes / r.delivered, delivered: r.delivered, day: dayFrom.toISOString().slice(0, 10) };
  const breaches = breachesOf(table, dailyUnsubs);
  await ensurePauseTable(env);
  const fresh = [];
  for (const b of breaches) {
    const res = await env.DB.prepare('INSERT OR IGNORE INTO stream_pauses (stream, reason) VALUES (?, ?)').bind(b.stream, b.reason).run();
    pausedCache.delete(b.stream);
    if (Number(res?.meta?.changes || 0) > 0) fresh.push(b);
  }
  if (fresh.length && notify) {
    try { await notify(fresh); } catch (error) { console.error('stream pause notice failed:', error?.message || error); }
  }
  return { paused: fresh, table };
}
