// N5 (Addendum N, ROADMAP step 153; framework DR-18): where visitors come from, kept apart from which form they used.
//
//   signup_source  (M1)  the surface:  home, check, pto, route ...            -> users.signup_source
//   signup_channel (N5)  the channel:  utm_source, else the referrer class,    -> users.signup_channel
//                        else direct;  signup_campaign is utm_campaign;           users.signup_campaign
//                        signup_referrer_class is search/social/email/other_site/direct
//
// Both are first touch: set once on a new row and never overwritten.  Visits are counted as daily totals in
// landings_daily(date, channel, campaign, page_class, count): no IP address, no user agent, no identifier of any
// kind is stored, so a visit is only ever a +1 on a row.  Bot user agents are not counted (classifyUserAgent).
//
// Everything here is behind ENABLE_LANDING_COUNTER (default "false"): until the owner has approved the privacy-page line
// (Guard read) the endpoint counts nothing and signups store no channel.
import { classifyUserAgent } from './botClass.js';

export const REFERRER_CLASSES = ['search', 'social', 'email', 'other_site', 'direct'];
export const PAGE_CLASSES = ['home', 'route', 'check', 'pto', 'report', 'other'];
export const MAX_COMBOS_PER_DAY = 200; // distinct (channel, campaign) pairs a day; keeps garbage values from growing the table

export const landingCounterEnabled = (env) => env?.ENABLE_LANDING_COUNTER === 'true';

const clean = (v, n) => String(v ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, n);

/** { channel, campaign, referrer_class } from a request body, or null if there is no usable channel. */
export function normalizeAttribution(body) {
  if (!body || typeof body !== 'object') return null;
  const channel = clean(body.channel, 20);
  if (!channel) return null;
  const rc = clean(body.referrer_class, 12);
  return { channel, campaign: clean(body.campaign, 16), referrer_class: REFERRER_CLASSES.includes(rc) ? rc : null };
}

/** A landing report from the browser, or null if it does not fit. Nothing else in the body is read. */
export function normalizeLanding(body) {
  const a = normalizeAttribution(body);
  if (!a) return null;
  const page = clean(body.page_class, 12);
  if (!PAGE_CLASSES.includes(page)) return null;
  return { channel: a.channel, campaign: a.campaign, page_class: page };
}

/** Count one landing. Returns { counted, reason }. Never throws. */
export async function recordLanding(env, request, body, now = new Date()) {
  if (!landingCounterEnabled(env)) return { counted: false, reason: 'off' };
  if (!env?.DB) return { counted: false, reason: 'no_db' };
  if (classifyUserAgent(request.headers.get('user-agent')) !== 'human') return { counted: false, reason: 'not_human' };
  const landing = normalizeLanding(body);
  if (!landing) return { counted: false, reason: 'invalid' };
  const date = now.toISOString().slice(0, 10);
  try {
    const known = await env.DB.prepare('SELECT 1 AS x FROM landings_daily WHERE date = ? AND channel = ? AND campaign = ? LIMIT 1')
      .bind(date, landing.channel, landing.campaign).first();
    if (!known) {
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT DISTINCT channel, campaign FROM landings_daily WHERE date = ?)').bind(date).first();
      if ((row?.n ?? 0) >= MAX_COMBOS_PER_DAY) return { counted: false, reason: 'cap' };
    }
    await env.DB.prepare(
      `INSERT INTO landings_daily (date, channel, campaign, page_class, count) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(date, channel, campaign, page_class) DO UPDATE SET count = count + 1`
    ).bind(date, landing.channel, landing.campaign, landing.page_class).run();
    return { counted: true };
  } catch (error) {
    console.error('landing counter failed:', error);
    return { counted: false, reason: 'error' };
  }
}

/** First touch: stored once on a new user row and never changed (the WHERE clause refuses a second write). */
export async function storeSignupAttribution(env, userId, attribution) {
  if (!landingCounterEnabled(env) || !env?.DB || !userId || !attribution) return false;
  try {
    await env.DB.prepare(
      `UPDATE users SET signup_channel = ?, signup_campaign = ?, signup_referrer_class = ?
        WHERE id = ? AND signup_channel IS NULL`
    ).bind(attribution.channel, attribution.campaign || null, attribution.referrer_class, userId).run();
    return true;
  } catch (error) {
    console.error('signup attribution failed:', error); // a missing column must never fail a signup
    return false;
  }
}
