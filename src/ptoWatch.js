// PTO long-weekend window watches (ROADMAP step 74, Track C of claude_code_pto_fare_calendar_2026-10-09.md).
// Pure logic, token signing/verification, and Worker checker.
import { escapeHtml, originCity } from './emailTemplates/helpers.js';
import { DESTINATION_FIT, holidaysInRange, bridgeOpportunities } from './ptoCalendar.js';
import { PTO_ORIGINS, PTO_LAST_DAY, FARE_FRESH_DAYS } from './ptoPages.js';
import { sendPtoWindowEmail } from './email.js';
import { logEvent } from './index.js';

const enc = new TextEncoder();
const b64u = {
  encode(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// Signed token for canceling a PTO window watch without requiring an account.
// Prefix 'pto-watch-cancel:' isolates it from unsubscribe, reactivate, and trip-tap tokens.
export async function signPtoWatchToken(watchId, secret) {
  if (!watchId || !secret) throw new Error('signPtoWatchToken needs a watchId and secret');
  const payload = b64u.encode(enc.encode(JSON.stringify({ w: String(watchId) })));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`pto-watch-cancel:${payload}`)));
  return `${payload}.${b64u.encode(sig)}`;
}

export async function verifyPtoWatchToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || token.split('.').length !== 2) return null;
  try {
    const [payload, sigPart] = token.split('.');
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(`pto-watch-cancel:${payload}`));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64u.decode(payload)));
    if (!data || typeof data.w !== 'string') return null;
    return data.w;
  } catch {
    return null;
  }
}

// Validates whether the given start/end is a genuine bridge window for the given origin/year range.
export function isValidPtoWindow(windowStart, windowEnd) {
  if (!windowStart || !windowEnd) return false;
  const holidays = holidaysInRange({ from: '2026-01-01', to: PTO_LAST_DAY });
  const blocks = bridgeOpportunities({ from: '2026-01-01', to: PTO_LAST_DAY, holidays });
  return blocks.some((b) => b.start === windowStart && b.end === windowEnd);
}

// Validates origin against the 15 US hubs
export function isValidPtoOrigin(origin) {
  return PTO_ORIGINS.includes(String(origin || '').toUpperCase());
}

// Validates destination against DESTINATION_FIT table (if provided)
export function isValidPtoDestination(destination) {
  if (!destination) return true; // null or empty is valid (means any fitting destination)
  return Object.prototype.hasOwnProperty.call(DESTINATION_FIT, destination);
}

// Rule for whether a new fare warrants an alert:
// First fare seen: sends alert.
// Subsequent fare: must be lower than last_alert_price by at least max($15, 5%).
export function shouldSendAlert(currentPrice, lastAlertPrice) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;
  if (!lastAlertPrice) return true; // first fare seen
  const dropDollars = lastAlertPrice - currentPrice;
  const dropPct = dropDollars / lastAlertPrice;
  return dropDollars >= 15 || dropPct >= 0.05;
}

// Daily checker called from Worker scheduled() cron (at 08:00 UTC, failure-isolated)
export async function checkPtoWindowWatches(env, now = new Date()) {
  if (env?.ENABLE_PTO_WATCH !== 'true') return { checked: 0, alerted: 0, purged: 0 };
  if (!env?.DB) return { checked: 0, alerted: 0, purged: 0 };

  const todayIso = now.toISOString().slice(0, 10);
  const cutoffIso = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  // Housekeeping: delete watches whose window_end is more than 30 days past (rule 9)
  const purgeRes = await env.DB.prepare('DELETE FROM pto_window_watches WHERE window_end < ?').bind(cutoffIso).run();
  const purged = purgeRes?.meta?.changes || 0;

  // Load window prices store
  let pricesStore = null;
  try {
    const { loadJsonAsset } = await import('./index.js');
    pricesStore = await loadJsonAsset(env, 'sparkfare_pto_window_prices.json');
  } catch (err) {
    console.error('Failed to load sparkfare_pto_window_prices.json:', err);
    return { checked: 0, alerted: 0, purged };
  }
  if (!pricesStore || !pricesStore.windows) return { checked: 0, alerted: 0, purged };

  // Select active watches with window_end in the future for eligible users:
  // - verified_email = 1, unsubscribed_at IS NULL, is_subscribed = 1
  // - not paused
  const rows = await env.DB.prepare(`
    SELECT w.id, w.user_id, w.origin_iata, w.window_start, w.window_end, w.destination,
           w.last_alert_price, w.last_alerted_at,
           u.email, u.unsubscribed_at, u.is_subscribed, u.paused_until
    FROM pto_window_watches w
    JOIN users u ON u.id = w.user_id
    WHERE w.window_end >= ?
      AND u.verified_email = 1
      AND u.unsubscribed_at IS NULL
      AND u.is_subscribed = 1
      AND (u.paused_until IS NULL OR datetime(u.paused_until) < datetime('now'))
  `).bind(todayIso).all();

  const watches = rows.results || [];
  if (watches.length === 0) return { checked: 0, alerted: 0, purged };

  // Check email suppressions
  const suppressions = new Set();
  try {
    const supRows = await env.DB.prepare('SELECT email FROM email_suppressions').all();
    for (const r of supRows.results || []) suppressions.add(r.email.toLowerCase());
  } catch {}

  // Group candidates by user email: at most one email per user per day (combine watches)
  const userAlerts = new Map(); // email -> [ { watch, bestFare } ]

  for (const watch of watches) {
    const email = watch.email.toLowerCase();
    if (suppressions.has(email)) continue;

    // Check if alerted today already for this watch
    if (watch.last_alerted_at && watch.last_alerted_at.slice(0, 10) === todayIso) continue;

    const windowKey = `${watch.origin_iata}:${watch.window_start}:${watch.window_end}`;
    const windowData = pricesStore.windows[windowKey];
    if (!windowData || !Array.isArray(windowData.fares)) continue;

    // Find qualifying fares:
    // - destination matches watch.destination (if set)
    // - fare found_at is no older than FARE_FRESH_DAYS (3 days)
    const candidates = windowData.fares.filter((f) => {
      if (!f || !Number.isFinite(Number(f.price)) || Number(f.price) <= 0) return false;
      if (watch.destination && f.destination !== watch.destination) return false;
      if (!f.found_at) return false;
      const ageDays = (now.getTime() - new Date(f.found_at).getTime()) / 86400000;
      return Number.isFinite(ageDays) && ageDays <= FARE_FRESH_DAYS;
    });

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => Number(a.price) - Number(b.price));
    const bestFare = candidates[0];

    if (!shouldSendAlert(Number(bestFare.price), watch.last_alert_price)) continue;

    if (!userAlerts.has(email)) userAlerts.set(email, []);
    userAlerts.get(email).push({ watch, bestFare });
  }

  let alertedCount = 0;
  const secret = env.UNSUBSCRIBE_SECRET || env.JWT_SECRET || 'sparkfare-pto-secret';

  for (const [email, items] of userAlerts.entries()) {
    try {
      // Pick the lead alert for subject / main body, include others if combined
      const lead = items[0];
      const cancelTokens = await Promise.all(items.map((it) => signPtoWatchToken(it.watch.id, secret)));

      await sendPtoWindowEmail({
        email,
        origin: lead.watch.origin_iata,
        items: items.map((it, idx) => ({
          watchId: it.watch.id,
          origin: it.watch.origin_iata,
          windowStart: it.watch.window_start,
          windowEnd: it.watch.window_end,
          destination: it.bestFare.destination,
          price: Number(it.bestFare.price),
          foundAt: it.bestFare.found_at,
          bookingLink: it.bestFare.booking_link,
          cancelToken: cancelTokens[idx],
        })),
      }, env);

      // Update watches
      for (const it of items) {
        await env.DB.prepare(`
          UPDATE pto_window_watches
          SET last_alert_price = ?, last_alerted_at = datetime('now')
          WHERE id = ?
        `).bind(Number(it.bestFare.price), it.watch.id).run();

        await logEvent(env, {
          event_type: 'pto_watch_alert_sent',
          origin: it.watch.origin_iata,
          route: it.bestFare.destination,
          user_id: it.watch.user_id,
        });
      }

      alertedCount += items.length;
    } catch (err) {
      console.error(`Failed to send PTO window alert to ${email}:`, err);
    }
  }

  return { checked: watches.length, alerted: alertedCount, purged };
}
