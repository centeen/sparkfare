// E3 "skip if unchanged" (ROADMAP step 21). The daily digest used to send every day whether or not anything
// had moved, so near-identical emails went out day after day, which is what SparkLoop objected to. With
// ENABLE_DIGEST_SKIP_UNCHANGED on, each origin's deals are compared with what was last emailed for that origin:
//   NEW              the route was not in the last-sent digest
//   PRICE DROP       cheaper than last time by at least max(MIN_DROP_USD, MIN_DROP_PCT of the old price)
//   STILL AVAILABLE  present with no meaningful drop
// and a subscriber is skipped for the day only if nothing is NEW or a PRICE DROP, they have received a digest
// before, and their last digest was under MAX_QUIET_DAYS ago (so nobody goes silent for long).
//
// Everything here fails open: if a lookup or write throws, the digest is sent exactly as it was before.

export const DIGEST_CHANGE = {
  MIN_DROP_USD: 10,   // judgement calls, not a spec: small enough to catch a real drop, large enough to ignore noise
  MIN_DROP_PCT: 2,
  MAX_QUIET_DAYS: 4,
};

// Only the exact string "true" turns it on, like the other digest flags.
export function skipUnchangedEnabled(env) {
  return env?.ENABLE_DIGEST_SKIP_UNCHANGED === 'true';
}

export async function ensureSnapshotTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS digest_sent_snapshots (
      origin TEXT NOT NULL,
      sent_on TEXT NOT NULL,
      deals_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (origin, sent_on)
    )
  `).run();
}

// Pure. `previous` is an array of { display_name, price } from the last-sent digest, or null when there is
// none (then everything is NEW and the digest always goes out).
export function classifyDeals(deals, previous) {
  const prevPrice = new Map();
  for (const p of previous || []) if (p && p.display_name != null) prevPrice.set(p.display_name, Number(p.price));

  let changed = !previous || previous.length === 0;
  const counts = { new: 0, price_drop: 0, still_available: 0 };
  const classified = (deals || []).map((deal) => {
    let status;
    const old = prevPrice.get(deal.display_name);
    if (old === undefined || !Number.isFinite(old)) {
      status = 'new';
    } else {
      const needed = Math.max(DIGEST_CHANGE.MIN_DROP_USD, old * (DIGEST_CHANGE.MIN_DROP_PCT / 100));
      status = Number(deal.price) <= old - needed ? 'price_drop' : 'still_available';
    }
    counts[status] += 1;
    if (status !== 'still_available') changed = true;
    return old !== undefined && Number.isFinite(old)
      ? { ...deal, email_status: status, previous_price: old }
      : { ...deal, email_status: status };
  });
  return { deals: classified, changed, counts };
}

// Whole days between two YYYY-MM-DD strings (UTC).
export function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000);
}

// Pure. A subscriber is skipped only when every condition holds.
export function shouldSkipUser({ changed, lastSentOn, today }) {
  if (changed) return false;
  if (!lastSentOn) return false; // never received one: always send
  return daysBetween(lastSentOn, today) < DIGEST_CHANGE.MAX_QUIET_DAYS;
}

// The most recent snapshot from a day before `today`, so the 07:00 and 08:00 runs share one baseline.
export async function loadPreviousSnapshot(env, origin, today) {
  await ensureSnapshotTable(env);
  const row = await env.DB.prepare(
    'SELECT deals_json FROM digest_sent_snapshots WHERE origin = ? AND sent_on < ? ORDER BY sent_on DESC LIMIT 1'
  ).bind(origin, today).first();
  if (!row) return null;
  try { return JSON.parse(row.deals_json); } catch { return null; }
}

// Records what was emailed for this origin today. The first send of the day wins (INSERT OR IGNORE).
export async function recordSnapshot(env, origin, today, deals) {
  await ensureSnapshotTable(env);
  const slim = (deals || []).map((d) => ({ display_name: d.display_name, price: d.price }));
  await env.DB.prepare(
    'INSERT OR IGNORE INTO digest_sent_snapshots (origin, sent_on, deals_json) VALUES (?, ?, ?)'
  ).bind(origin, today, JSON.stringify(slim)).run();
}

// The subscriber's most recent digest before today, or null.
export async function lastSentBefore(env, email, today) {
  const row = await env.DB.prepare(
    "SELECT MAX(delivered_on) AS d FROM daily_alert_deliveries WHERE email = ? AND status = 'sent' AND delivered_on < ?"
  ).bind(email, today).first();
  return row?.d || null;
}
