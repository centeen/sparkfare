// Leave-by plan reminder emails (Addendum G, task G7; ROADMAP step 93). Behind ENABLE_PLAN_REMINDERS (default "false"), and only while
// ENABLE_LEAVE_BY_PLAN is on too.
//
// What a visitor opts in to: "Email me each item when it's due." Nothing is sent but one confirmation email until they click its link
// (double opt-in; a scanner that only opens the link cannot confirm, because confirming is a POST from the page it opens). A plan that is
// never confirmed is deleted after 7 days. Once confirmed, one email goes out on each item's suggested date, items due within 3 days of
// each other share an email, and a plan never gets more than 6. Every email has a stop link and List-Unsubscribe headers that stop ALL
// plan emails for that address. Everything stored about a plan is deleted 30 days after the back date.
//
// The plan is rebuilt from the stored answers each time an email is due, so a rule the watcher has put on hold is left out.
import {
  buildLeaveByPlan, LEAVE_BY_DESTINATIONS, DESTINATION_COUNTRY_MAP, bucketForDays, addDaysIso, daysBetweenIso, LEAVE_BY_RULES,
} from './data/leaveByRules.js';
import { getRuleOverrides, ruleWatcherEnabled } from './ruleWatcher.js';
import { planEventMeta, PLAN_SOURCE } from './planEvents.js';
import { classifyUserAgent } from './botClass.js';
import { sendPlanConfirmEmail, sendPlanReminderEmail, sendYoureSetEmail } from './email.js';

export const PLAN_REMINDERS = {
  MAX_EMAILS: 6,
  COMBINE_DAYS: 3,
  PENDING_TTL_DAYS: 7,
  RETENTION_DAYS: 30,
  OPTIN_COOLDOWN_MINUTES: 10,
  MAX_PLANS_PER_EMAIL: 5,
  MAX_TRIP_DAYS: 400,
  CATCH_UP_DAYS: 2,
  MAX_ATTEMPTS: 3,
};

// Addendum G task G8: the "You're set" email goes out on the evening before leaving, from 18:00 in the home airport's time zone.
// All 22 marketed US origins, plus TLV (its evening falls before any cron that runs, so it is not mailed; see runYoureSetEmails).
import { ORIGIN_TIME_ZONES } from './originZones.js';
export { ORIGIN_TIME_ZONES };
export const DEFAULT_TIME_ZONE = 'America/New_York'; // when a plan has no origin and the address has no saved one
export const EVENING_START_HOUR = 18;

// The date and hour (0-23) at `date` in a time zone. An unknown zone falls back to the default.
export function localParts(date, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  }
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: get('year') + '-' + get('month') + '-' + get('day'), hour: Number(get('hour')) };
}

// True when it is the evening before the leaving day in the plan's time zone: that local date is the day before, and it is 18:00 or later.
export function youreSetDue(leaveDate, now, timeZone) {
  const p = localParts(now, timeZone);
  return p.date === addDaysIso(leaveDate, -1) && p.hour >= EVENING_START_HOUR;
}

export function planRemindersEnabled(env) {
  return env?.ENABLE_PLAN_REMINDERS === 'true' && env?.ENABLE_LEAVE_BY_PLAN === 'true';
}

const ANSWER_KEYS = ['pet_home', 'keeper', 'driving', 'airport_parking'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function ensurePlanTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS away_plans (
       id TEXT PRIMARY KEY,
       email TEXT NOT NULL,
       destination TEXT NOT NULL,
       destination_country TEXT NOT NULL,
       leave_date TEXT NOT NULL,
       back_date TEXT NOT NULL,
       bucket TEXT,
       answers_json TEXT NOT NULL,
       created_at TEXT NOT NULL,
       pending_until TEXT NOT NULL,
       confirmed_at TEXT,
       stopped_at TEXT,
       delete_after TEXT NOT NULL,
       origin TEXT,
       set_sent_at TEXT
     )`
  ).run();
  // A table made by G7 before G8 existed has no origin or set_sent_at column: add them.
  for (const column of ['origin TEXT', 'set_sent_at TEXT']) {
    try { await env.DB.prepare('ALTER TABLE away_plans ADD COLUMN ' + column).run(); } catch { /* already there */ }
  }
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS away_plan_done (
       plan_id TEXT NOT NULL,
       rule_id TEXT NOT NULL,
       done_at TEXT NOT NULL,
       PRIMARY KEY (plan_id, rule_id)
     )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS away_plan_reminders (
       plan_id TEXT NOT NULL,
       send_on TEXT NOT NULL,
       item_ids_json TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'scheduled',
       attempts INTEGER NOT NULL DEFAULT 0,
       sent_at TEXT,
       PRIMARY KEY (plan_id, send_on)
     )`
  ).run();
}

// ---- tokens ----------------------------------------------------------------------------------------------------------------------
// token = base64url(plan id) + "." + base64url(HMAC-SHA256(secret, kind + ":" + plan id)). The kind is part of the signed message, so a
// confirm token can never stop a plan and a stop token can never confirm one, and neither works for the other products' links.
const enc = new TextEncoder();
const b64u = {
  encode(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(str) { return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)); },
};
const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signPlanToken(secret, kind, planId) {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`plan-${kind}:${planId}`)));
  return `${b64u.encode(enc.encode(planId))}.${b64u.encode(sig)}`;
}

export async function verifyPlanToken(secret, kind, token) {
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const [idPart, sigPart] = token.split('.');
    const planId = new TextDecoder().decode(b64u.decode(idPart));
    if (!/^[0-9a-f]{32}$/.test(planId)) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(`plan-${kind}:${planId}`));
    return ok ? planId : null;
  } catch {
    return null;
  }
}

// A "mark this item done" link carries the plan id and one rule id, signed as "plan-done:<plan>:<rule>", so it cannot be used for any other
// purpose and cannot be pointed at another item.
const RULE_IDS = new Set(LEAVE_BY_RULES.map((r) => r.id));
export async function signItemToken(secret, planId, ruleId) {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`plan-done:${planId}:${ruleId}`)));
  return `${b64u.encode(enc.encode(planId + ':' + ruleId))}.${b64u.encode(sig)}`;
}

export async function verifyItemToken(secret, token) {
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const [payload, sigPart] = token.split('.');
    const [planId, ruleId] = new TextDecoder().decode(b64u.decode(payload)).split(':');
    if (!/^[0-9a-f]{32}$/.test(planId || '') || !RULE_IDS.has(ruleId)) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(`plan-done:${planId}:${ruleId}`));
    return ok ? { planId, ruleId } : null;
  } catch {
    return null;
  }
}

function newPlanId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- opt-in validation -----------------------------------------------------------------------------------------------------------
export function validateOptin(body, todayIso) {
  const b = body && typeof body === 'object' ? body : {};
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL.test(email)) return { ok: false, error: 'email' };
  if (!LEAVE_BY_DESTINATIONS.includes(b.destination)) return { ok: false, error: 'destination' };
  const leave = typeof b.departureDate === 'string' && ISO.test(b.departureDate) ? b.departureDate : null;
  const back = typeof b.returnDate === 'string' && ISO.test(b.returnDate) ? b.returnDate : null;
  if (!leave || !back || Number.isNaN(Date.parse(leave)) || Number.isNaN(Date.parse(back))) return { ok: false, error: 'dates' };
  if (back < leave) return { ok: false, error: 'dates' };
  // a day of slack for a visitor whose date is a day ahead of ours
  if (leave < addDaysIso(todayIso, -1)) return { ok: false, error: 'dates' };
  const tripDays = daysBetweenIso(leave, back);
  if (tripDays === null || tripDays > PLAN_REMINDERS.MAX_TRIP_DAYS) return { ok: false, error: 'dates' };
  const answers = {};
  const given = b.answers && typeof b.answers === 'object' ? b.answers : {};
  for (const k of ANSWER_KEYS) answers[k] = given[k] === 'yes' ? 'yes' : 'no';
  // The origin the visitor chose on the site (used only to know their time zone), and the items they had already ticked as done.
  const origin = typeof b.origin === 'string' && Object.prototype.hasOwnProperty.call(ORIGIN_TIME_ZONES, b.origin.toUpperCase()) ? b.origin.toUpperCase() : null;
  const done = Array.isArray(b.done) ? [...new Set(b.done.filter((id) => typeof id === 'string' && RULE_IDS.has(id)))].slice(0, 40) : [];
  return {
    ok: true,
    plan: { email, destination: b.destination, destination_country: DESTINATION_COUNTRY_MAP[b.destination], leave_date: leave, back_date: back, bucket: bucketForDays(tripDays), answers, origin, done },
  };
}

// ---- the schedule ----------------------------------------------------------------------------------------------------------------
// entries: [{ id, date }] (date = the item's suggested date). Items due within `window` days of the first item in a group share one
// email, sent on the group's first date. If that makes more than `max` emails, the window grows a day at a time until it fits.
export function groupReminderDates(entries, { max = PLAN_REMINDERS.MAX_EMAILS, window = PLAN_REMINDERS.COMBINE_DAYS } = {}) {
  const sorted = [...entries].filter((e) => e && ISO.test(e.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!sorted.length) return [];
  for (let w = window; w <= 400; w++) {
    const groups = [];
    for (const e of sorted) {
      const g = groups[groups.length - 1];
      if (g && daysBetweenIso(g.send_on, e.date) <= w) g.itemIds.push(e.id);
      else groups.push({ send_on: e.date, itemIds: [e.id] });
    }
    if (groups.length <= max) return groups;
  }
  return [{ send_on: sorted[0].date, itemIds: sorted.map((e) => e.id) }];
}

function planFor(row, { today, overrides }) {
  return buildLeaveByPlan({
    destination: row.destination,
    departureDate: row.leave_date,
    returnDate: row.back_date,
    answers: JSON.parse(row.answers_json || '{}'),
    today,
    overrides,
  });
}

const dueItems = (plan, today) => plan.items.filter((i) => i.status === 'active' && i.actByDate && i.actByDate >= today && i.kind !== 'passport' && i.kind !== 'note');

export function buildSchedule(row, { today, overrides = null } = {}) {
  const plan = planFor(row, { today, overrides });
  return groupReminderDates(dueItems(plan, today).map((i) => ({ id: i.id, date: i.actByDate })));
}

// ---- small responses --------------------------------------------------------------------------------------------------------------
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const NOT_FOUND = () => new Response('Not found', { status: 404 });

function page(title, bodyHtml) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>${title} | Sparkfare</title>
<style>body{margin:0;background:#E8DCC5;color:#2E2318;font-family:'Segoe UI',sans-serif;line-height:1.6}.wrap{max-width:560px;margin:0 auto;padding:40px 16px}.card{background:#FAF6EE;border:1px solid #D9CBB0;border-radius:6px;padding:24px}h1{font-size:1.4rem;margin:0 0 10px}button{min-height:44px;padding:10px 18px;background:#4F7A52;color:#fff;border:none;border-radius:6px;font:inherit;font-weight:600;cursor:pointer}a{color:#3F6442}</style></head>
<body><div class="wrap"><div class="card"><h1>${title}</h1>${bodyHtml}</div><p><a href="/">Sparkfare</a></p></div></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

const tokenOf = (url) => url.searchParams.get('token') || '';
const appUrlOf = (env) => env?.APP_URL || 'https://sparkfare.com';

// ---- POST /api/plan-reminders/optin ----------------------------------------------------------------------------------------------
// The one place a plan's dates leave the visitor's browser, and only after they ask for reminders. Every answer is the same, whether or
// not the address could be mailed, so the form cannot be used to find out who has an account or who has been suppressed.
export async function handlePlanOptin(request, env, { now = new Date() } = {}) {
  if (!planRemindersEnabled(env)) return json(404, { ok: false, error: 'Not found' });
  if (!env?.DB || !env.UNSUBSCRIBE_SECRET) return json(503, { ok: false, error: 'Reminders are not available right now.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Request body must be valid JSON' }); }
  const todayIso = now.toISOString().slice(0, 10);
  const v = validateOptin(body, todayIso);
  if (!v.ok) return json(400, { ok: false, error: v.error });
  const same = { ok: true, message: "If that address can receive email, we've sent a confirmation. Nothing starts until you confirm." };

  try {
    await ensurePlanTables(env);
    const p = v.plan;
    const since = new Date(now.getTime() - PLAN_REMINDERS.OPTIN_COOLDOWN_MINUTES * 60000).toISOString();
    const recent = await env.DB.prepare('SELECT 1 AS x FROM away_plans WHERE email = ? AND created_at > ? LIMIT 1').bind(p.email, since).first();
    if (recent) return json(200, same);
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM away_plans WHERE email = ? AND stopped_at IS NULL').bind(p.email).first();
    if ((count?.n || 0) >= PLAN_REMINDERS.MAX_PLANS_PER_EMAIL) return json(200, same);

    const id = newPlanId();
    await env.DB.prepare(
      `INSERT INTO away_plans (id, email, destination, destination_country, leave_date, back_date, bucket, answers_json, created_at, pending_until, delete_after, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, p.email, p.destination, p.destination_country, p.leave_date, p.back_date, p.bucket, JSON.stringify(p.answers),
      now.toISOString(), addDaysIso(todayIso, PLAN_REMINDERS.PENDING_TTL_DAYS), addDaysIso(p.back_date, PLAN_REMINDERS.RETENTION_DAYS), p.origin
    ).run();
    for (const ruleId of p.done) {
      await env.DB.prepare('INSERT OR IGNORE INTO away_plan_done (plan_id, rule_id, done_at) VALUES (?, ?, ?)').bind(id, ruleId, now.toISOString()).run();
    }

    const appUrl = appUrlOf(env);
    const confirmUrl = `${appUrl}/api/plan-reminders/confirm?token=${await signPlanToken(env.UNSUBSCRIBE_SECRET, 'confirm', id)}`;
    const stopUrl = `${appUrl}/api/plan-reminders/stop?token=${await signPlanToken(env.UNSUBSCRIBE_SECRET, 'stop', id)}`;
    try {
      await sendPlanConfirmEmail({ email: p.email, confirmUrl, stopUrl }, env);
    } catch (error) {
      console.error('Plan confirmation email failed:', error);
    }
  } catch (error) {
    console.error('Plan opt-in failed:', error);
  }
  return json(200, same);
}

// ---- confirm and stop pages ---------------------------------------------------------------------------------------------------
export async function handlePlanConfirm(request, env, { now = new Date(), logEvent = null } = {}) {
  if (!planRemindersEnabled(env)) return NOT_FOUND();
  const url = new URL(request.url);
  const planId = await verifyPlanToken(env?.UNSUBSCRIBE_SECRET, 'confirm', tokenOf(url));
  if (!planId) return page('This link is not valid', '<p>It may have been copied wrongly. You can make a new leave-by plan at any time.</p>');
  if (request.method === 'GET') {
    // Opening the link changes nothing: scanners that follow links must not be able to confirm for someone.
    return page('Confirm your reminders', `<p>We'll email you on the day each item in your leave-by plan is due, at most six emails in all. You can stop at any time.</p><form method="post" action="/api/plan-reminders/confirm?token=${encodeURIComponent(tokenOf(url))}"><button type="submit">Yes, email me</button></form>`);
  }
  if (!env?.DB) return json(503, { ok: false, error: 'Not available' });
  await ensurePlanTables(env);
  const row = await env.DB.prepare('SELECT * FROM away_plans WHERE id = ?').bind(planId).first();
  const todayIso = now.toISOString().slice(0, 10);
  if (!row) return page('This reminder has expired', '<p>Plans that are not confirmed within a week are deleted. You can make a new leave-by plan at any time.</p>');
  if (row.stopped_at) return page('These reminders were stopped', '<p>Make a new leave-by plan if you want reminders again.</p>');
  if (!row.confirmed_at && row.pending_until < todayIso) return page('This reminder has expired', '<p>Plans that are not confirmed within a week are deleted. You can make a new leave-by plan at any time.</p>');

  if (!row.confirmed_at) {
    await env.DB.prepare('UPDATE away_plans SET confirmed_at = ? WHERE id = ?').bind(now.toISOString(), planId).run();
    const overrides = ruleWatcherEnabled(env) ? await getRuleOverrides(env) : null;
    const schedule = buildSchedule(row, { today: todayIso, overrides });
    for (const g of schedule) {
      await env.DB.prepare('INSERT OR IGNORE INTO away_plan_reminders (plan_id, send_on, item_ids_json) VALUES (?, ?, ?)').bind(planId, g.send_on, JSON.stringify(g.itemIds)).run();
    }
    if (logEvent) {
      const meta = planEventMeta('reminder_optin', { trip_length_bucket: row.bucket });
      try {
        await logEvent(env, { event_type: 'reminder_optin', source: PLAN_SOURCE, meta: { ...meta, ua_class: classifyUserAgent(request.headers.get('User-Agent')) } });
      } catch (error) { console.error('reminder_optin event failed:', error); }
    }
  }
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM away_plan_reminders WHERE plan_id = ? AND status != 'stopped'").bind(planId).first())?.n || 0;
  // G9: a signed link that ties a Home card to this plan. It carries only the plan id, never a date or an address.
  const cardOn = env.ENABLE_HOME_CARD === 'true' && env.ENABLE_LEAVE_BY_PLAN === 'true';
  const cardLink = cardOn
    ? `<p><a href="/home-card?plan=${encodeURIComponent(await signPlanToken(env.UNSUBSCRIBE_SECRET, 'card', planId))}">Make a Home card for the person staying behind</a>. We'll mention it in your evening-before email.</p>`
    : '';
  return page("You're set", (n
    ? `<p>We'll send ${n === 1 ? 'one email' : `${n} emails`} for your leave-by plan, each on the day it's due. Every email has a link to stop them all.</p>`
    : `<p>Nothing in your plan is still due on a future day, so there is nothing to send. You can stop here.</p>`) + cardLink);
}

export async function handlePlanStop(request, env, { now = new Date() } = {}) {
  if (!planRemindersEnabled(env)) return NOT_FOUND();
  const url = new URL(request.url);
  const planId = await verifyPlanToken(env?.UNSUBSCRIBE_SECRET, 'stop', tokenOf(url));
  if (!planId) return page('This link is not valid', '<p>It may have been copied wrongly.</p>');
  if (request.method === 'GET') {
    return page('Stop all plan emails?', `<p>This stops every leave-by plan email to this address.</p><form method="post" action="/api/plan-reminders/stop?token=${encodeURIComponent(tokenOf(url))}"><button type="submit">Stop plan emails</button></form>`);
  }
  // POST: the button above, or a mail client's one-click unsubscribe (its body is "List-Unsubscribe=One-Click"; the token is in the address).
  if (env?.DB) {
    await ensurePlanTables(env);
    const row = await env.DB.prepare('SELECT email FROM away_plans WHERE id = ?').bind(planId).first();
    if (row) {
      await env.DB.prepare('UPDATE away_plans SET stopped_at = ? WHERE email = ? AND stopped_at IS NULL').bind(now.toISOString(), row.email).run();
      await env.DB.prepare("UPDATE away_plan_reminders SET status = 'stopped' WHERE status = 'scheduled' AND plan_id IN (SELECT id FROM away_plans WHERE email = ?)").bind(row.email).run();
    }
  }
  return page('Stopped', '<p>You will not get any more leave-by plan emails.</p>');
}

// ---- the daily job ----------------------------------------------------------------------------------------------------------------
export async function runPlanReminders(env, { now = new Date() } = {}) {
  if (!planRemindersEnabled(env) || !env?.DB) return { ok: true, skipped: true };
  await ensurePlanTables(env);
  const todayIso = now.toISOString().slice(0, 10);
  const out = { ok: true, purged: 0, sent: 0, skipped: 0, failed: 0 };

  // Retention: unconfirmed plans after a week, everything 30 days after the back date.
  const stale = await env.DB.prepare('SELECT id FROM away_plans WHERE (confirmed_at IS NULL AND pending_until < ?) OR delete_after < ?').bind(todayIso, todayIso).all();
  const ids = (stale.results || []).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const marks = chunk.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM away_plan_reminders WHERE plan_id IN (${marks})`).bind(...chunk).run();
    await env.DB.prepare(`DELETE FROM away_plan_done WHERE plan_id IN (${marks})`).bind(...chunk).run();
    await env.DB.prepare(`DELETE FROM away_plans WHERE id IN (${marks})`).bind(...chunk).run();
  }
  out.purged = ids.length;

  const due = await env.DB.prepare(
    `SELECT r.plan_id AS plan_id, r.send_on AS send_on, r.item_ids_json AS item_ids_json, r.attempts AS attempts, p.*
       FROM away_plan_reminders r JOIN away_plans p ON p.id = r.plan_id
      WHERE r.status = 'scheduled' AND r.send_on <= ? AND p.confirmed_at IS NOT NULL AND p.stopped_at IS NULL AND p.leave_date >= ?
      ORDER BY r.send_on`
  ).bind(todayIso, todayIso).all();

  const overrides = ruleWatcherEnabled(env) ? await getRuleOverrides(env) : null;
  const setStatus = (row, status, extra = '') => env.DB.prepare(`UPDATE away_plan_reminders SET status = ?${extra} WHERE plan_id = ? AND send_on = ?`).bind(status, row.plan_id, row.send_on).run();

  for (const row of due.results || []) {
    // A day missed by the job is made up for a little while, then dropped: a reminder that is days late is no longer a reminder.
    if (daysBetweenIso(row.send_on, todayIso) > PLAN_REMINDERS.CATCH_UP_DAYS) { await setStatus(row, 'missed'); out.skipped += 1; continue; }
    const sentCount = (await env.DB.prepare("SELECT COUNT(*) AS n FROM away_plan_reminders WHERE plan_id = ? AND status = 'sent'").bind(row.plan_id).first())?.n || 0;
    if (sentCount >= PLAN_REMINDERS.MAX_EMAILS) { await setStatus(row, 'skipped'); out.skipped += 1; continue; }

    const wanted = new Set(JSON.parse(row.item_ids_json || '[]'));
    const plan = planFor(row, { today: todayIso, overrides });
    // Items still active (the watcher may have put one on hold since opt-in); dates are not repeated in the email.
    const doneIds = new Set(((await env.DB.prepare('SELECT rule_id FROM away_plan_done WHERE plan_id = ?').bind(row.plan_id).all()).results || []).map((r) => r.rule_id));
    const live = plan.items.filter((i) => wanted.has(i.id) && i.status === 'active' && !doneIds.has(i.id));
    if (!live.length) { await setStatus(row, 'skipped'); out.skipped += 1; continue; }

    try {
      const appUrl = appUrlOf(env);
      const items = [];
      for (const i of live) items.push({ ...i, doneUrl: `${appUrl}/api/plan-reminders/done?token=${await signItemToken(env.UNSUBSCRIBE_SECRET, row.plan_id, i.id)}` });
      const stopUrl = `${appUrl}/api/plan-reminders/stop?token=${await signPlanToken(env.UNSUBSCRIBE_SECRET, 'stop', row.plan_id)}`;
      const result = await sendPlanReminderEmail({ email: row.email, items, stopUrl, bucket: row.bucket, now }, env);
      // Q1: the send budget deferred it (the reader already has another email today). Not a failed attempt: it stays scheduled and the catch-up window decides when it is too late.
      if (result?.deferred) { out.deferred = (out.deferred || 0) + 1; continue; }
      if (result?.ok === false) throw new Error(result.error?.message || 'send failed');
      await env.DB.prepare("UPDATE away_plan_reminders SET status = 'sent', sent_at = ? WHERE plan_id = ? AND send_on = ?").bind(now.toISOString(), row.plan_id, row.send_on).run();
      out.sent += 1;
    } catch (error) {
      console.error('Plan reminder failed:', error);
      const attempts = (row.attempts || 0) + 1;
      await env.DB.prepare('UPDATE away_plan_reminders SET attempts = ?, status = ? WHERE plan_id = ? AND send_on = ?')
        .bind(attempts, attempts >= PLAN_REMINDERS.MAX_ATTEMPTS ? 'failed' : 'scheduled', row.plan_id, row.send_on).run();
      out.failed += 1;
    }
  }
  return out;
}

// True when the traveler already has confirmed plan reminders for this trip (same address, same country, same leaving day), so the
// fixed 14/7/1-day Away Mode emails for it are not sent as well.
export async function planCoversTrip(env, email, destination, departureIso) {
  if (!planRemindersEnabled(env) || !env?.DB || !email || !departureIso) return false;
  try {
    await ensurePlanTables(env);
    const country = DESTINATION_COUNTRY_MAP[destination];
    if (!country) return false;
    const row = await env.DB.prepare(
      'SELECT 1 AS x FROM away_plans WHERE email = ? AND destination_country = ? AND leave_date = ? AND confirmed_at IS NOT NULL AND stopped_at IS NULL LIMIT 1'
    ).bind(String(email).toLowerCase(), country, departureIso).first();
    return Boolean(row);
  } catch {
    return false;
  }
}

// ---- marking an item done from a reminder ---------------------------------------------------------------------------------------------
// The link in a reminder opens a page whose button POSTs (so a link scanner cannot mark anything). Done items are not reminded again and
// are listed as done in the evening-before email.
export async function handlePlanDone(request, env, { now = new Date() } = {}) {
  if (!planRemindersEnabled(env)) return NOT_FOUND();
  const url = new URL(request.url);
  const t = await verifyItemToken(env?.UNSUBSCRIBE_SECRET, tokenOf(url));
  if (!t) return page('This link is not valid', '<p>It may have been copied wrongly.</p>');
  const rule = LEAVE_BY_RULES.find((r) => r.id === t.ruleId);
  const title = rule ? rule.title.replace(/[<>&"]/g, '') : 'this item';
  if (request.method === 'GET') {
    return page('Mark this done?', `<p>${title}</p><form method="post" action="/api/plan-reminders/done?token=${encodeURIComponent(tokenOf(url))}"><button type="submit">Mark done</button></form>`);
  }
  if (env?.DB) {
    await ensurePlanTables(env);
    const row = await env.DB.prepare('SELECT stopped_at FROM away_plans WHERE id = ?').bind(t.planId).first();
    if (row && !row.stopped_at) {
      await env.DB.prepare('INSERT OR IGNORE INTO away_plan_done (plan_id, rule_id, done_at) VALUES (?, ?, ?)').bind(t.planId, t.ruleId, now.toISOString()).run();
    }
  }
  return page('Marked done', `<p>${title} is marked done. We won't remind you about it again.</p>`);
}

// ---- the evening-before email ("You're set"), Addendum G task G8 ------------------------------------------------------------------------
// On the evening before the leaving day (from 18:00 in the home airport's time zone) each confirmed plan gets ONE email saying what is done,
// what is still open, and, if the traveler made one, a short line about their Home card (G9; `homeCardSummary` is supplied by that feature and
// is null until it exists). Open items keep their official page and, only where a partner does the job, that item's own disclosed partner link.
// Nothing goes to a plan that is unconfirmed, stopped or already mailed. It reuses the daily scheduled runs: any run that falls after 18:00
// local on that evening sends it; for every US origin that is the 03:30 UTC run (19:30 to 23:30 local). TLV's evening falls before any run, so
// a Tel Aviv origin is never mailed.
export async function runYoureSetEmails(env, { now = new Date(), homeCardSummary = null } = {}) {
  if (!planRemindersEnabled(env) || !env?.DB) return { ok: true, skipped: true };
  await ensurePlanTables(env);
  const todayIso = now.toISOString().slice(0, 10);
  const out = { ok: true, sent: 0, skipped: 0, failed: 0 };
  const candidates = await env.DB.prepare(
    `SELECT * FROM away_plans
      WHERE confirmed_at IS NOT NULL AND stopped_at IS NULL AND set_sent_at IS NULL AND leave_date >= ? AND leave_date <= ?`
  ).bind(todayIso, addDaysIso(todayIso, 2)).all();
  const overrides = ruleWatcherEnabled(env) ? await getRuleOverrides(env) : null;

  for (const row of candidates.results || []) {
    let tz = ORIGIN_TIME_ZONES[row.origin];
    if (!tz) {
      try {
        const u = await env.DB.prepare('SELECT origin_iata FROM users WHERE lower(email) = ?').bind(row.email).first();
        tz = ORIGIN_TIME_ZONES[u?.origin_iata];
      } catch { /* no users table in this database */ }
    }
    tz = tz || DEFAULT_TIME_ZONE;
    if (!youreSetDue(row.leave_date, now, tz)) { out.skipped += 1; continue; }

    const localToday = localParts(now, tz).date;
    const plan = planFor(row, { today: localToday, overrides });
    const doneIds = new Set(((await env.DB.prepare('SELECT rule_id FROM away_plan_done WHERE plan_id = ?').bind(row.id).all()).results || []).map((r) => r.rule_id));
    const universe = [...plan.items, ...(plan.pastItems || [])].filter((i) => i.status === 'active' && i.kind !== 'passport' && i.kind !== 'note');
    const doneItems = universe.filter((i) => doneIds.has(i.id));
    const appUrl = appUrlOf(env);
    const openItems = [];
    for (const i of universe.filter((x) => !doneIds.has(x.id))) {
      openItems.push({ ...i, doneUrl: `${appUrl}/api/plan-reminders/done?token=${await signItemToken(env.UNSUBSCRIBE_SECRET, row.id, i.id)}` });
    }
    if (!universe.length) { await env.DB.prepare('UPDATE away_plans SET set_sent_at = ? WHERE id = ?').bind(now.toISOString(), row.id).run(); out.skipped += 1; continue; }

    try {
      const homeCard = homeCardSummary ? await homeCardSummary(env, row) : null;
      const stopUrl = `${appUrl}/api/plan-reminders/stop?token=${await signPlanToken(env.UNSUBSCRIBE_SECRET, 'stop', row.id)}`;
      const result = await sendYoureSetEmail({ email: row.email, destination: row.destination, doneItems, openItems, homeCard, stopUrl, bucket: row.bucket, now }, env);
      if (result?.deferred) { out.deferred = (out.deferred || 0) + 1; continue; } // Q1: the next run the same evening tries again
      if (result?.ok === false) throw new Error(result.error?.message || 'send failed');
      await env.DB.prepare('UPDATE away_plans SET set_sent_at = ? WHERE id = ?').bind(now.toISOString(), row.id).run();
      out.sent += 1;
    } catch (error) {
      console.error("You're set email failed:", error);
      out.failed += 1; // set_sent_at stays empty: the next run on the same evening tries again
    }
  }
  return out;
}
