// The Home card (Addendum G, task G9, ROADMAP step 95): a private page the traveler shares with whoever stays behind (a house or pet
// sitter, a neighbor, a relative). The traveler lists tasks (by day, or daily) and a few "if something goes wrong" notes.
// Rules this file enforces, each with a test:
//  - no codes or passwords: text that looks like an alarm/door/gate/garage/lock/key-box code or a Wi-Fi password is refused;
//  - the link is a random token of 192 bits; only its SHA-256 is stored; the page is noindex and never cached;
//  - the card expires 7 days after the back date and the traveler can remove it any time (a second secret that only they hold);
//  - the keeper needs no account; the page has no partner links and no Sparkfare signup prompt;
//  - only a count of opens is logged (no token, no address); only a size bucket of the task list is logged at creation.
import { planEventMeta, PLAN_SOURCE } from './planEvents.js';
import { verifyPlanToken } from './planReminders.js';

export const HOME_CARD = {
  EXPIRES_AFTER_DAYS: 7, // after the back date
  PURGE_AFTER_DAYS: 1, // a row is deleted this long after it expired
  MAX_TASKS: 30,
  MAX_NOTES: 10,
  MAX_TASK_CHARS: 120,
  MAX_NOTE_CHARS: 300,
  MAX_LABEL_CHARS: 40,
  MAX_TRIP_DAYS: 120,
  MAX_DAYS_AHEAD: 366,
};

export const CODE_REFUSAL = "Please don't put codes or passwords here. Share those in person.";
export const INACTIVE_MESSAGE = 'This card is no longer active.';

// The patterns in Addendum G, with tolerance for punctuation: "alarm code", "alarm-code", "garage PIN", "key box pin", "wifi password", "Wi-Fi pw".
const CODE_PATTERNS = [
  /(alarm|door|gate|garage|lock|key[\s_-]*box)[\s:_-]*(code|pin)/i,
  /wi[\s_-]?fi[\s:_-]*(password|pw)/i,
  /(alarm|door|gate|garage|lock|key[\s_-]*box)[\s:_-]*(passcode|combination)/i,
];
export function looksLikeSecret(text) {
  const t = String(text || '');
  return CODE_PATTERNS.some((re) => re.test(t));
}

export function homeCardEnabled(env) {
  return env?.ENABLE_HOME_CARD === 'true' && env?.ENABLE_LEAVE_BY_PLAN === 'true';
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function validIso(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function tasksBucket(n) { return n <= 3 ? '1-3' : n <= 9 ? '4-9' : '10+'; }

// Returns { ok: true, card } or { ok: false, error, secret?: true }. Pure: `todayIso` is passed in.
export function validateCard(body, todayIso) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const { leaveDate, backDate } = body;
  if (!validIso(leaveDate) || !validIso(backDate)) return { ok: false, error: 'Enter the day you leave and the day you are back.' };
  if (backDate < leaveDate) return { ok: false, error: 'The back date is before the day you leave.' };
  if (backDate < todayIso) return { ok: false, error: 'The back date has already passed.' };
  if (daysBetween(todayIso, backDate) > HOME_CARD.MAX_DAYS_AHEAD) return { ok: false, error: 'That is too far ahead.' };
  if (daysBetween(leaveDate, backDate) > HOME_CARD.MAX_TRIP_DAYS) return { ok: false, error: 'That trip is longer than a card supports.' };

  const rawTasks = Array.isArray(body.tasks) ? body.tasks : [];
  const rawNotes = Array.isArray(body.notes) ? body.notes : [];
  if (rawTasks.length < 1) return { ok: false, error: 'Add at least one task.' };
  if (rawTasks.length > HOME_CARD.MAX_TASKS) return { ok: false, error: `A card holds up to ${HOME_CARD.MAX_TASKS} tasks.` };
  if (rawNotes.length > HOME_CARD.MAX_NOTES) return { ok: false, error: `A card holds up to ${HOME_CARD.MAX_NOTES} notes.` };

  const tasks = [];
  for (const t of rawTasks) {
    const text = clean(t?.text, HOME_CARD.MAX_TASK_CHARS);
    if (!text) return { ok: false, error: 'Every task needs a few words.' };
    if (looksLikeSecret(text)) return { ok: false, error: CODE_REFUSAL, secret: true };
    const when = t?.when === 'daily' ? 'daily' : t?.when;
    if (when !== 'daily') {
      if (!validIso(when)) return { ok: false, error: 'Every task is either daily or on a day.' };
      if (when < leaveDate || when > backDate) return { ok: false, error: 'A task day falls outside your trip.' };
    }
    tasks.push({ text, when });
  }
  const notes = [];
  for (const n of rawNotes) {
    const label = clean(n?.label, HOME_CARD.MAX_LABEL_CHARS);
    const text = clean(n?.text, HOME_CARD.MAX_NOTE_CHARS);
    if (!label && !text) continue;
    if (looksLikeSecret(label) || looksLikeSecret(text)) return { ok: false, error: CODE_REFUSAL, secret: true };
    notes.push({ label: label || 'Note', text });
  }
  return { ok: true, card: { leaveDate, backDate, tasks, notes } };
}

// ---- storage ----

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
export function newSecret() { return b64url(crypto.getRandomValues(new Uint8Array(24))); } // 192 bits
export async function hashSecret(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('home-card:' + s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32}$/;

export async function ensureHomeCardTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS home_cards (
    view_hash TEXT PRIMARY KEY,
    manage_hash TEXT NOT NULL,
    plan_id TEXT,
    leave_date TEXT NOT NULL,
    back_date TEXT NOT NULL,
    tasks_json TEXT NOT NULL,
    notes_json TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    removed_at TEXT,
    created_at TEXT NOT NULL
  )`).run();
}

const json = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const appUrlOf = (env) => (env.APP_URL || 'https://sparkfare.com').replace(/\/$/, '');

// A card is tied to a plan only by a token the confirm page issued (signed 'plan-card:<id>'). A missing, forged or stale token, or a plan
// that is not confirmed or was stopped, just leaves the card unlinked; the answer to the visitor is the same either way.
async function linkedPlanId(env, token) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const id = await verifyPlanToken(env.UNSUBSCRIBE_SECRET, 'card', token);
    if (!id) return null;
    const row = await env.DB.prepare('SELECT confirmed_at, stopped_at FROM away_plans WHERE id = ?').bind(id).first();
    return row && row.confirmed_at && !row.stopped_at ? id : null;
  } catch { return null; }
}

// POST /api/home-card. Returns the link to share and the one to remove it with. The two secrets are shown once and never stored in the clear.
export async function handleCardCreate(request, env, { now = new Date(), logEvent = null } = {}) {
  if (!homeCardEnabled(env)) return json(404, { ok: false, error: 'Not found' });
  if (!env.DB) return json(503, { ok: false, error: 'Home cards are not available right now.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Invalid request.' }); }
  const v = validateCard(body, now.toISOString().slice(0, 10));
  if (!v.ok) return json(400, { ok: false, error: v.error, secret: v.secret === true });
  await ensureHomeCardTable(env);
  const planId = await linkedPlanId(env, body?.planToken);
  const view = newSecret();
  const manage = newSecret();
  const c = v.card;
  await env.DB.prepare(
    `INSERT INTO home_cards (view_hash, manage_hash, plan_id, leave_date, back_date, tasks_json, notes_json, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(await hashSecret(view), await hashSecret(manage), planId, c.leaveDate, c.backDate, JSON.stringify(c.tasks), JSON.stringify(c.notes), addDays(c.backDate, HOME_CARD.EXPIRES_AFTER_DAYS), now.toISOString()).run();
  if (logEvent) {
    const meta = planEventMeta('homecard_created', { tasks_bucket: tasksBucket(c.tasks.length) });
    await logEvent(env, { event_type: 'homecard_created', source: PLAN_SOURCE, meta });
  }
  const base = appUrlOf(env);
  return json(200, { ok: true, viewUrl: `${base}/card/${view}`, removeUrl: `${base}/api/home-card/remove?token=${manage}`, expiresAfter: addDays(c.backDate, HOME_CARD.EXPIRES_AFTER_DAYS) });
}

// GET shows a button (a mail scanner or a link preview must not remove a card); POST removes.
export async function handleCardRemove(request, env, { now = new Date() } = {}) {
  if (!homeCardEnabled(env)) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  let token = url.searchParams.get('token') || '';
  if (request.method === 'GET') {
    const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Remove your Home card</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem"><h1>Remove your Home card</h1><p>The link you shared will stop working right away.</p><form method="post" action="/api/home-card/remove?token=${esc(token)}"><button type="submit" style="font-size:1rem;padding:.7rem 1.2rem">Remove the card</button></form></body></html>`;
    return new Response(page, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
  }
  if (!token) { try { token = String((await request.clone().json())?.token || ''); } catch { /* no body */ } }
  const wantsHtml = (request.headers.get('Accept') || '').includes('text/html');
  const done = (ok, msg, status) => wantsHtml
    ? new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Home card</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem"><p>${esc(msg)}</p></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } })
    : json(status, { ok, message: msg });
  if (!env.DB || !TOKEN_SHAPE.test(token)) return done(false, 'That link is not valid.', 400);
  await ensureHomeCardTable(env);
  const r = await env.DB.prepare('SELECT view_hash, removed_at FROM home_cards WHERE manage_hash = ?').bind(await hashSecret(token)).first();
  if (!r) return done(false, 'That link is not valid, or the card has already been deleted.', 404);
  if (!r.removed_at) {
    // The content is cleared, not just hidden.
    await env.DB.prepare("UPDATE home_cards SET removed_at = ?, tasks_json = '[]', notes_json = '[]' WHERE view_hash = ?").bind(now.toISOString(), r.view_hash).run();
  }
  return done(true, 'Your Home card has been removed. The link you shared no longer works.', 200);
}

// ---- the page the keeper sees ----

function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function renderCardHtml(card) {
  const daily = card.tasks.filter((t) => t.when === 'daily');
  const byDay = new Map();
  for (const t of card.tasks.filter((x) => x.when !== 'daily')) { if (!byDay.has(t.when)) byDay.set(t.when, []); byDay.get(t.when).push(t); }
  const days = [...byDay.keys()].sort();
  const list = (items) => `<ul>${items.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul>`;
  const parts = [];
  if (daily.length) parts.push(`<section><h2>Every day</h2>${list(daily)}</section>`);
  for (const d of days) parts.push(`<section><h2>${esc(dayLabel(d))}</h2>${list(byDay.get(d))}</section>`);
  const notes = card.notes.length
    ? `<section><h2>If something goes wrong</h2><dl>${card.notes.map((n) => `<dt>${esc(n.label)}</dt><dd>${esc(n.text)}</dd>`).join('')}</dl></section>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>Home card</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:40rem;margin:0 auto;padding:1.25rem 1rem 3rem;color:#1d1d1b;background:#fbf8f1;line-height:1.5}
h1{font-size:1.5rem;margin:.2rem 0}h2{font-size:1.05rem;margin:1.4rem 0 .3rem}ul{margin:.2rem 0;padding-left:1.2rem}li{margin:.25rem 0}
dt{font-weight:600;margin-top:.7rem}dd{margin:.1rem 0 0}.sub{color:#555}
.print{margin:1rem 0}button{font:inherit;padding:.5rem 1rem}
@media print{body{background:#fff;padding:0}.print{display:none}}
</style></head><body>
<h1>Home card</h1>
<p class="sub">From ${esc(dayLabel(card.leaveDate))} to ${esc(dayLabel(card.backDate))}.</p>
<p class="print"><button type="button" onclick="window.print()">Print this card</button></p>
${parts.join('\n')}
${notes}
<p class="sub">This page is private. It stops working a week after they are back.</p>
</body></html>`;
}

const pageHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export function inactivePage() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Home card</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem"><p>${INACTIVE_MESSAGE}</p></body></html>`, { status: 404, headers: pageHeaders });
}

// GET /card/<token>. An unknown, expired and removed card all look the same, so a guess learns nothing.
export async function handleCardView(request, env, token, { now = new Date(), logEvent = null } = {}) {
  if (!homeCardEnabled(env)) return new Response('Not found', { status: 404 });
  if (!env.DB || !TOKEN_SHAPE.test(token || '')) return inactivePage();
  await ensureHomeCardTable(env);
  const r = await env.DB.prepare('SELECT * FROM home_cards WHERE view_hash = ?').bind(await hashSecret(token)).first();
  if (!r || r.removed_at || r.expires_at < now.toISOString().slice(0, 10)) return inactivePage();
  if (logEvent && request.method === 'GET') {
    await logEvent(env, { event_type: 'homecard_open', source: PLAN_SOURCE, meta: planEventMeta('homecard_open', {}) });
  }
  let tasks = []; let notes = [];
  try { tasks = JSON.parse(r.tasks_json); notes = JSON.parse(r.notes_json); } catch { return inactivePage(); }
  return new Response(renderCardHtml({ leaveDate: r.leave_date, backDate: r.back_date, tasks, notes }), { status: 200, headers: pageHeaders });
}

// Daily housekeeping: delete a card the day after it expires, and any removed card straight away.
export async function purgeHomeCards(env, { now = new Date() } = {}) {
  if (!homeCardEnabled(env) || !env?.DB) return { ok: true, skipped: true };
  await ensureHomeCardTable(env);
  const cutoff = addDays(now.toISOString().slice(0, 10), -HOME_CARD.PURGE_AFTER_DAYS);
  const r = await env.DB.prepare('DELETE FROM home_cards WHERE expires_at < ? OR removed_at IS NOT NULL').bind(cutoff).run();
  return { ok: true, deleted: r?.meta?.changes ?? null };
}

// What the evening-before email (G8) says about a plan's card: a count and the expiry, never the content. A card is tied to a plan only
// when plan_id is set (by the signed link on the reminders confirm page); otherwise this returns null.
export async function homeCardSummary(env, planRow) {
  if (!homeCardEnabled(env) || !env?.DB || !planRow?.id) return null;
  await ensureHomeCardTable(env);
  const r = await env.DB.prepare('SELECT tasks_json, notes_json, expires_at FROM home_cards WHERE plan_id = ? AND removed_at IS NULL ORDER BY created_at DESC').bind(planRow.id).first();
  if (!r) return null;
  let t = 0; let n = 0;
  try { t = JSON.parse(r.tasks_json).length; n = JSON.parse(r.notes_json).length; } catch { return null; }
  return { lines: [`Your Home card has ${t} ${t === 1 ? 'task' : 'tasks'}${n ? ` and ${n} ${n === 1 ? 'note' : 'notes'}` : ''}.`, 'The link you shared is the only way to see it. You can remove it any time.'] };
}
