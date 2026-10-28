// Addendum Q, Q6 (D-049, G115): clicks, not opens. A click is a stronger sign of a human reader than an open (an open is a tracking-pixel fetch that Apple Mail
// Privacy Protection and mail scanners fire for everyone), so `users.last_clicked_at` is what protects a subscriber from the pause rule, and an open can only ever
// delay a pause, never cause one.
//
// A click that arrives within SCANNER_WINDOW_SECONDS of the same email's `email.delivered` event is almost certainly a link scanner following every link as the
// mail lands. It is logged (meta.scanner_suspect = true) and does NOT update last_clicked_at. A click with no stored delivery time is counted: without the
// `email.delivered` event we cannot tell, and treating an unknown as a scanner would make a missing webhook subscription silently disable the signal.
import { logEvent } from './index.js';

export const SCANNER_WINDOW_SECONDS = 60;
export const DELIVERY_TIME_RETENTION_DAYS = 7;
export const PAUSE_RULE = { noClickDays: 90, noOpenDays: 45, minAccountDays: 90 };

const READY = new WeakSet();
export async function ensureClickSchema(env) {
  if (!env?.DB || READY.has(env.DB)) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS email_delivery_times (email_id TEXT PRIMARY KEY, delivered_at TEXT NOT NULL)').run();
  try { await env.DB.prepare('ALTER TABLE users ADD COLUMN last_clicked_at TEXT').run(); } catch { /* already there */ }
  READY.add(env.DB);
}

const eventTime = (event) => {
  const t = Date.parse(event?.created_at || event?.data?.created_at || '');
  return Number.isFinite(t) ? t : Date.now();
};
const recipientsOf = (event) => (Array.isArray(event?.data?.to) ? event.data.to : (event?.data?.to ? [event.data.to] : []));

/** `email.delivered`: remember when each email reached the inbox, so a click seconds later can be recognised as a scanner. */
export async function recordDelivered(env, event) {
  const emailId = event?.data?.email_id;
  if (!env?.DB || !emailId) return false;
  await ensureClickSchema(env);
  await env.DB.prepare('INSERT OR REPLACE INTO email_delivery_times (email_id, delivered_at) VALUES (?, ?)').bind(emailId, new Date(eventTime(event)).toISOString()).run();
  return true;
}

/** True when the click came so soon after delivery that a person cannot have made it. Unknown delivery time: false. */
export async function isScannerClick(env, event) {
  const emailId = event?.data?.email_id;
  if (!env?.DB || !emailId) return false;
  const row = await env.DB.prepare('SELECT delivered_at FROM email_delivery_times WHERE email_id = ?').bind(emailId).first();
  if (!row) return false;
  const delta = (eventTime(event) - Date.parse(row.delivered_at)) / 1000;
  return Number.isFinite(delta) && delta < SCANNER_WINDOW_SECONDS; // a negative delta (click seen before delivery) is within the window too
}

/**
 * `email.clicked`: log it (with the reader's user id, so clicks can be counted per person) and, unless it looks like a scanner, record the click on the user.
 * Returns { scannerSuspect, updated }. Never throws: a webhook must still answer 200.
 */
export async function handleClick(env, event, tagMeta = {}) {
  const out = { scannerSuspect: false, updated: 0 };
  if (!env?.DB) return out;
  try {
    await ensureClickSchema(env);
    out.scannerSuspect = await isScannerClick(env, event);
    for (const email of recipientsOf(event)) {
      const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      await logEvent(env, {
        event_type: 'email_click', user_id: user?.id || null,
        meta: { email_id: event.data?.email_id, link: event.data?.click?.link, scanner_suspect: out.scannerSuspect, ...tagMeta },
      });
      if (!out.scannerSuspect && user) {
        await env.DB.prepare("UPDATE users SET last_clicked_at = datetime('now') WHERE email = ?").bind(email).run();
        out.updated += 1;
      }
    }
  } catch (error) {
    console.error('Click handling failed:', error?.message || error);
  }
  return out;
}

/** A human confirmed it on a page (the reactivation button): that is a click as far as the pause rule is concerned. Never throws. */
export async function markClickedByEmail(env, email) {
  if (!env?.DB || !email) return;
  try {
    await ensureClickSchema(env);
    await env.DB.prepare("UPDATE users SET last_clicked_at = datetime('now') WHERE email = ?").bind(email).run();
  } catch (error) { console.error('markClickedByEmail failed:', error?.message || error); }
}

/** Delivery times only matter for a minute; keep a week and drop the rest. */
export async function purgeDeliveryTimes(env) {
  if (!env?.DB) return;
  try {
    await ensureClickSchema(env);
    const cutoff = new Date(Date.now() - DELIVERY_TIME_RETENTION_DAYS * 86400000).toISOString(); // stored as ISO, so compared as ISO
    await env.DB.prepare('DELETE FROM email_delivery_times WHERE delivered_at < ?').bind(cutoff).run();
  } catch (error) { console.error('purgeDeliveryTimes failed:', error?.message || error); }
}
